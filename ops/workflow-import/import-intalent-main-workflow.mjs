import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectPath = path.resolve(process.env.INTALENT_PROJECT_PATH || path.join(scriptDir, "..", ".."));
const envPath = path.join(projectPath, ".env");

dotenv.config({ path: envPath });

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

const requestedPhone = String(args.get("phone") || "").replace(/\D/g, "");
const definitionPath = path.resolve(
  args.get("definition") || path.join(scriptDir, "workflow-definition.json"),
);
const dryRun = args.get("dry-run") === "true";
const forceInsert = args.get("force-insert") === "true";

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name} in ${envPath}`);
  return value;
}

function validateDefinition(definition) {
  const errors = [];
  const steps = Array.isArray(definition.steps) ? definition.steps : [];
  if (!definition.name?.trim()) errors.push("Workflow name is required.");
  if (!definition.welcomeMessage?.trim()) errors.push("Welcome message is required.");
  if (steps.length === 0) errors.push("At least one step is required.");

  const ids = new Set();
  for (const [index, step] of steps.entries()) {
    const number = index + 1;
    if (!step.id?.trim()) errors.push(`Step #${number} has no id.`);
    if (ids.has(step.id)) errors.push(`Step #${number} has a duplicate id.`);
    ids.add(step.id);
    if (!step.questionText?.trim()) errors.push(`Step #${number} has no message text.`);
    if (step.type === "menu") {
      if (!Array.isArray(step.options) || step.options.length === 0) {
        errors.push(`Step #${number} is a menu without options.`);
      }
      const keys = new Set();
      for (const option of step.options || []) {
        const key = String(option.key || "").trim().toLowerCase();
        if (!key) errors.push(`Step #${number} has an option without a key.`);
        if (keys.has(key)) errors.push(`Step #${number} duplicates option key ${key}.`);
        keys.add(key);
        if (!String(option.text || "").trim()) errors.push(`Step #${number}, option ${key}, has no label.`);
        if (!String(option.nextStepId || "").trim()) errors.push(`Step #${number}, option ${key}, has no next step.`);
      }
    }
  }

  for (const [index, step] of steps.entries()) {
    if (step.nextStepId && !ids.has(step.nextStepId)) {
      errors.push(`Step #${index + 1} points to missing step ${step.nextStepId}.`);
    }
    for (const option of step.options || []) {
      if (option.nextStepId && !ids.has(option.nextStepId)) {
        errors.push(`Step #${index + 1}, option ${option.key}, points to missing step ${option.nextStepId}.`);
      }
    }
  }

  if (errors.length) throw new Error(`Workflow definition validation failed:\n- ${errors.join("\n- ")}`);
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnSet(client, tableName) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function main() {
  if (!fs.existsSync(definitionPath)) throw new Error(`Definition file not found: ${definitionPath}`);
  const definition = JSON.parse(fs.readFileSync(definitionPath, "utf8"));
  validateDefinition(definition);

  const pool = new Pool({
    host: requireEnv("SQL_HOST"),
    port: Number(process.env.SQL_PORT || 5432),
    user: requireEnv("SQL_USER"),
    password: requireEnv("SQL_PASSWORD"),
    database: requireEnv("SQL_DB_NAME"),
    connectionTimeoutMillis: 15000,
    ssl: String(process.env.SQL_SSL || "").toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (!(await tableExists(client, "workflows")) || !(await tableExists(client, "whatsapp_numbers"))) {
      throw new Error("Required workflows or whatsapp_numbers table does not exist.");
    }

    const columns = await columnSet(client, "workflows");
    const requiredColumns = [
      "start_mode",
      "is_default",
      "restart_on_closed_message",
      "fallback_on_unmatched_message",
    ];
    const missing = requiredColumns.filter((name) => !columns.has(name));
    if (missing.length) {
      throw new Error(
        `Catch-all workflow migration is incomplete. Missing workflow columns: ${missing.join(", ")}`,
      );
    }

    let numberResult;
    if (requestedPhone) {
      numberResult = await client.query(
        `SELECT id, display_name, phone_number, is_active
         FROM whatsapp_numbers
         WHERE regexp_replace(phone_number, '\\D', '', 'g') = $1
         ORDER BY id DESC`,
        [requestedPhone],
      );
    } else {
      numberResult = await client.query(
        `SELECT id, display_name, phone_number, is_active
         FROM whatsapp_numbers
         WHERE is_active = true
         ORDER BY id`,
      );
    }

    if (numberResult.rowCount === 0) {
      throw new Error(requestedPhone
        ? `No WhatsApp line found for phone ${requestedPhone}.`
        : "No active WhatsApp line found.");
    }
    if (numberResult.rowCount > 1 && !requestedPhone) {
      const list = numberResult.rows.map((row) => `${row.phone_number} (${row.display_name})`).join(", ");
      throw new Error(`Multiple active WhatsApp lines found. Run again with --phone=<number>. Lines: ${list}`);
    }

    const line = numberResult.rows[0];
    const workflowsBefore = await client.query(
      `SELECT * FROM workflows WHERE whatsapp_number_id = $1 ORDER BY id`,
      [line.id],
    );

    const backupsDir = path.join(scriptDir, "backups");
    fs.mkdirSync(backupsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupsDir, `workflows-${line.id}-${timestamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        whatsappNumber: line,
        workflows: workflowsBefore.rows,
      }, null, 2),
      "utf8",
    );

    const existingNamed = await client.query(
      `SELECT * FROM workflows
       WHERE whatsapp_number_id = $1 AND lower(name) = lower($2)
       ORDER BY id DESC LIMIT 1`,
      [line.id, definition.name],
    );

    let targetId = existingNamed.rows[0]?.id || null;
    if (!targetId && !forceInsert) {
      const existingDefault = await client.query(
        `SELECT * FROM workflows
         WHERE whatsapp_number_id = $1 AND is_default = true
         ORDER BY id DESC LIMIT 1`,
        [line.id],
      );
      targetId = existingDefault.rows[0]?.id || null;
    }

    await client.query(
      `UPDATE workflows
       SET is_default = false,
           start_mode = 'keyword',
           restart_on_closed_message = false,
           fallback_on_unmatched_message = false
       WHERE whatsapp_number_id = $1
         AND ($2::integer IS NULL OR id <> $2::integer)`,
      [line.id, targetId],
    );

    const stepsJson = JSON.stringify(definition.steps);
    let saved;
    if (targetId) {
      saved = await client.query(
        `UPDATE workflows
         SET name = $2,
             trigger_keyword = $3,
             start_mode = 'default',
             is_default = true,
             restart_on_closed_message = true,
             fallback_on_unmatched_message = true,
             welcome_message = $4,
             is_active = true,
             steps = $5
         WHERE id = $1 AND whatsapp_number_id = $6
         RETURNING id, whatsapp_number_id, name, trigger_keyword, start_mode,
                   is_default, restart_on_closed_message,
                   fallback_on_unmatched_message, is_active, created_at`,
        [targetId, definition.name, definition.triggerKeyword, definition.welcomeMessage, stepsJson, line.id],
      );
    } else {
      saved = await client.query(
        `INSERT INTO workflows (
           whatsapp_number_id, name, trigger_keyword, start_mode, is_default,
           restart_on_closed_message, fallback_on_unmatched_message,
           welcome_message, is_active, steps
         ) VALUES ($1, $2, $3, 'default', true, true, true, $4, true, $5)
         RETURNING id, whatsapp_number_id, name, trigger_keyword, start_mode,
                   is_default, restart_on_closed_message,
                   fallback_on_unmatched_message, is_active, created_at`,
        [line.id, definition.name, definition.triggerKeyword, definition.welcomeMessage, stepsJson],
      );
      targetId = saved.rows[0].id;
    }

    if (await tableExists(client, "audit_logs")) {
      const auditColumns = await columnSet(client, "audit_logs");
      if (["action", "details"].every((name) => auditColumns.has(name))) {
        const columnsList = ["action", "details"];
        const values = [
          "Workflow Imported",
          `Imported ${definition.name} for WhatsApp Number ID ${line.id} using the one-click workflow importer.`,
        ];
        if (auditColumns.has("category")) { columnsList.push("category"); values.push("automation"); }
        if (auditColumns.has("severity")) { columnsList.push("severity"); values.push("success"); }
        if (auditColumns.has("success")) { columnsList.push("success"); values.push(true); }
        if (auditColumns.has("resource_type")) { columnsList.push("resource_type"); values.push("workflow"); }
        if (auditColumns.has("resource_id")) { columnsList.push("resource_id"); values.push(String(targetId)); }
        if (auditColumns.has("metadata")) {
          columnsList.push("metadata");
          values.push(JSON.stringify({ whatsappNumberId: line.id, workflowId: targetId, importer: "one-click" }));
        }
        const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
        await client.query(
          `INSERT INTO audit_logs (${columnsList.join(", ")}) VALUES (${placeholders})`,
          values,
        );
      }
    }

    const verify = await client.query(
      `SELECT id, name, trigger_keyword, start_mode, is_default,
              restart_on_closed_message, fallback_on_unmatched_message,
              is_active, steps
       FROM workflows WHERE id = $1`,
      [targetId],
    );
    const verifiedSteps = JSON.parse(verify.rows[0].steps || "[]");
    if (verifiedSteps.length !== definition.steps.length) {
      throw new Error(`Verification failed: expected ${definition.steps.length} steps, found ${verifiedSteps.length}.`);
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log("DRY RUN PASSED — no database changes were committed.");
    } else {
      await client.query("COMMIT");
      console.log("Workflow import completed successfully.");
    }

    console.log(`WhatsApp line : ${line.display_name} (${line.phone_number})`);
    console.log(`Workflow ID   : ${targetId}`);
    console.log(`Workflow name : ${definition.name}`);
    console.log(`Steps         : ${verifiedSteps.length}`);
    console.log(`Backup        : ${backupPath}`);
    console.log("Start rule    : first + closed + unmatched open-chat messages");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`IMPORT FAILED: ${error.message}`);
  process.exitCode = 1;
});
