import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectPath = path.resolve(process.env.INTALENT_PROJECT_PATH || path.join(scriptDir, "..", ".."));
dotenv.config({ path: path.join(projectPath, ".env") });

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));
const backupPath = path.resolve(String(args.get("backup") || ""));
if (!backupPath || !fs.existsSync(backupPath)) {
  console.error("ROLLBACK FAILED: provide an existing --backup=<json path>.");
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(backupPath, "utf8"));
if (!snapshot?.whatsappNumber?.id || !Array.isArray(snapshot.workflows)) {
  console.error("ROLLBACK FAILED: invalid workflow backup file.");
  process.exit(1);
}

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name} in project .env`);
  return value;
};

const pool = new Pool({
  host: required("SQL_HOST"),
  port: Number(process.env.SQL_PORT || 5432),
  user: required("SQL_USER"),
  password: required("SQL_PASSWORD"),
  database: required("SQL_DB_NAME"),
  connectionTimeoutMillis: 15000,
  ssl: String(process.env.SQL_SSL || "").toLowerCase() === "true"
    ? { rejectUnauthorized: false }
    : undefined,
});

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const numberId = Number(snapshot.whatsappNumber.id);
  const snapshotIds = new Set(snapshot.workflows.map((row) => Number(row.id)));

  for (const row of snapshot.workflows) {
    await client.query(
      `UPDATE workflows
       SET whatsapp_number_id = $2,
           name = $3,
           trigger_keyword = $4,
           start_mode = $5,
           is_default = $6,
           restart_on_closed_message = $7,
           fallback_on_unmatched_message = $8,
           welcome_message = $9,
           is_active = $10,
           steps = $11
       WHERE id = $1`,
      [
        row.id,
        row.whatsapp_number_id,
        row.name,
        row.trigger_keyword,
        row.start_mode,
        row.is_default,
        row.restart_on_closed_message,
        row.fallback_on_unmatched_message,
        row.welcome_message,
        row.is_active,
        row.steps,
      ],
    );
  }

  const current = await client.query(
    `SELECT id, name FROM workflows WHERE whatsapp_number_id = $1`,
    [numberId],
  );
  for (const row of current.rows) {
    const rowId = Number(row.id);
    if (snapshotIds.has(rowId)) continue;
    if (String(row.name).toLowerCase() !== "intalent whatsapp main menu".toLowerCase()) continue;

    const sessions = await client.query(
      `SELECT COUNT(*)::integer AS count FROM workflow_sessions WHERE workflow_id = $1`,
      [rowId],
    );
    if (Number(sessions.rows[0]?.count || 0) === 0) {
      await client.query(`DELETE FROM workflows WHERE id = $1`, [rowId]);
    } else {
      await client.query(
        `UPDATE workflows
         SET is_active = false,
             is_default = false,
             start_mode = 'keyword',
             restart_on_closed_message = false,
             fallback_on_unmatched_message = false,
             trigger_keyword = $2
         WHERE id = $1`,
        [rowId, `archived_menu_${rowId}`],
      );
    }
  }

  await client.query("COMMIT");
  console.log(`Workflow configuration restored from ${backupPath}`);
} catch (error) {
  try { await client.query("ROLLBACK"); } catch {}
  console.error(`ROLLBACK FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
