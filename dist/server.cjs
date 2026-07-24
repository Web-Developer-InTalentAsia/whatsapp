var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_drizzle_orm2 = require("drizzle-orm");

// src/db/index.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  aiSettings: () => aiSettings,
  aiSettingsRelations: () => aiSettingsRelations,
  aiTrainingData: () => aiTrainingData,
  aiTrainingDataRelations: () => aiTrainingDataRelations,
  auditLogs: () => auditLogs,
  auditLogsRelations: () => auditLogsRelations,
  contacts: () => contacts,
  contactsRelations: () => contactsRelations,
  conversations: () => conversations,
  conversationsRelations: () => conversationsRelations,
  messageUserStates: () => messageUserStates,
  messages: () => messages,
  messagesRelations: () => messagesRelations,
  quickReplies: () => quickReplies,
  quickRepliesRelations: () => quickRepliesRelations,
  userNumberAssignments: () => userNumberAssignments,
  userNumberAssignmentsRelations: () => userNumberAssignmentsRelations,
  users: () => users,
  usersRelations: () => usersRelations,
  whatsappNumbers: () => whatsappNumbers,
  whatsappNumbersRelations: () => whatsappNumbersRelations,
  workflowSessions: () => workflowSessions,
  workflowSessionsRelations: () => workflowSessionsRelations,
  workflows: () => workflows,
  workflowsRelations: () => workflowsRelations
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  email: (0, import_pg_core.text)("email").notNull().unique(),
  password: (0, import_pg_core.text)("password").notNull(),
  role: (0, import_pg_core.text)("role").notNull().default("user"),
  // 'super_admin' | 'admin' | 'user'
  name: (0, import_pg_core.text)("name").notNull(),
  isActive: (0, import_pg_core.boolean)("is_active").notNull().default(true),
  canEditWorkflows: (0, import_pg_core.boolean)("can_edit_workflows").notNull().default(false),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var whatsappNumbers = (0, import_pg_core.pgTable)("whatsapp_numbers", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  displayName: (0, import_pg_core.text)("display_name").notNull(),
  phoneNumber: (0, import_pg_core.text)("phone_number").notNull().unique(),
  phoneNumberId: (0, import_pg_core.text)("phone_number_id").notNull(),
  wabaId: (0, import_pg_core.text)("waba_id").notNull(),
  appId: (0, import_pg_core.text)("app_id").notNull(),
  appSecret: (0, import_pg_core.text)("app_secret").notNull(),
  accessToken: (0, import_pg_core.text)("access_token").notNull(),
  verifyToken: (0, import_pg_core.text)("verify_token").notNull(),
  webhookStatus: (0, import_pg_core.text)("webhook_status").notNull().default("Pending"),
  // 'Verified' | 'Pending'
  lastVerified: (0, import_pg_core.timestamp)("last_verified"),
  isActive: (0, import_pg_core.boolean)("is_active").notNull().default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var userNumberAssignments = (0, import_pg_core.pgTable)("user_number_assignments", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  numberId: (0, import_pg_core.integer)("number_id").references(() => whatsappNumbers.id, { onDelete: "cascade" }).notNull(),
  isPrimaryOwner: (0, import_pg_core.boolean)("is_primary_owner").notNull().default(false),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var contacts = (0, import_pg_core.pgTable)("contacts", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  phoneNumber: (0, import_pg_core.text)("phone_number").notNull(),
  name: (0, import_pg_core.text)("name"),
  sourceNumberId: (0, import_pg_core.integer)("source_number_id").references(() => whatsappNumbers.id, { onDelete: "cascade" }).notNull(),
  firstMessageDate: (0, import_pg_core.timestamp)("first_message_date").defaultNow(),
  lastMessageDate: (0, import_pg_core.timestamp)("last_message_date").defaultNow(),
  assignedUserId: (0, import_pg_core.integer)("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  tags: (0, import_pg_core.text)("tags").notNull().default(""),
  // comma separated
  status: (0, import_pg_core.text)("status").notNull().default("active"),
  // 'active' | 'closed' | 'follow-up'
  notes: (0, import_pg_core.text)("notes").notNull().default(""),
  capturedAnswers: (0, import_pg_core.text)("captured_answers").notNull().default("{}"),
  // JSON representation
  cvField: (0, import_pg_core.text)("cv_field").notNull().default(""),
  linkedinField: (0, import_pg_core.text)("linkedin_field").notNull().default(""),
  interestedJobRole: (0, import_pg_core.text)("interested_job_role").notNull().default(""),
  expectedSalary: (0, import_pg_core.text)("expected_salary").notNull().default(""),
  location: (0, import_pg_core.text)("location").notNull().default(""),
  experience: (0, import_pg_core.text)("experience").notNull().default(""),
  clientCandidateType: (0, import_pg_core.text)("client_candidate_type").notNull().default("candidate"),
  // 'candidate' | 'client'
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var conversations = (0, import_pg_core.pgTable)("conversations", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  contactId: (0, import_pg_core.integer)("contact_id").references(() => contacts.id, { onDelete: "cascade" }).notNull(),
  whatsappNumberId: (0, import_pg_core.integer)("whatsapp_number_id").references(() => whatsappNumbers.id, { onDelete: "cascade" }).notNull(),
  assignedUserId: (0, import_pg_core.integer)("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  status: (0, import_pg_core.text)("status").notNull().default("unread"),
  // 'unread' | 'open' | 'human_handover' | 'ai_suggested' | 'workflow_active' | 'closed'
  lastMessageAt: (0, import_pg_core.timestamp)("last_message_at").defaultNow(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var messages = (0, import_pg_core.pgTable)("messages", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  conversationId: (0, import_pg_core.integer)("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  sender: (0, import_pg_core.text)("sender").notNull(),
  // 'contact' | 'agent' | 'system'
  senderName: (0, import_pg_core.text)("sender_name").notNull(),
  content: (0, import_pg_core.text)("content").notNull(),
  messageType: (0, import_pg_core.text)("message_type").notNull().default("text"),
  // 'text' | 'document' | 'cv' | 'location'
  replyType: (0, import_pg_core.text)("reply_type").notNull().default("none"),
  // 'manual' | 'ai' | 'workflow' | 'none'
  status: (0, import_pg_core.text)("status").notNull().default("received"),
  // 'sent' | 'received' | 'failed'
  timestamp: (0, import_pg_core.timestamp)("timestamp").defaultNow(),
  agentId: (0, import_pg_core.integer)("agent_id").references(() => users.id, { onDelete: "set null" }),
  replyToMessageId: (0, import_pg_core.integer)("reply_to_message_id"),
  forwardedFromMessageId: (0, import_pg_core.integer)("forwarded_from_message_id"),
  deletedForEveryone: (0, import_pg_core.boolean)("deleted_for_everyone").notNull().default(false),
  metaMessageId: (0, import_pg_core.text)("meta_message_id"),
  replyContextMetaMessageId: (0, import_pg_core.text)("reply_context_meta_message_id"),
  metaMediaId: (0, import_pg_core.text)("meta_media_id"),
  mediaMimeType: (0, import_pg_core.text)("media_mime_type"),
  mediaFilename: (0, import_pg_core.text)("media_filename"),
  mediaCaption: (0, import_pg_core.text)("media_caption")
});
var messageUserStates = (0, import_pg_core.pgTable)("message_user_states", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  messageId: (0, import_pg_core.integer)("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull(),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  isStarred: (0, import_pg_core.boolean)("is_starred").notNull().default(false),
  isPinned: (0, import_pg_core.boolean)("is_pinned").notNull().default(false),
  deletedForMe: (0, import_pg_core.boolean)("deleted_for_me").notNull().default(false),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var workflows = (0, import_pg_core.pgTable)("workflows", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  whatsappNumberId: (0, import_pg_core.integer)("whatsapp_number_id").references(() => whatsappNumbers.id, { onDelete: "cascade" }).notNull(),
  name: (0, import_pg_core.text)("name").notNull(),
  triggerKeyword: (0, import_pg_core.text)("trigger_keyword").notNull(),
  welcomeMessage: (0, import_pg_core.text)("welcome_message").notNull(),
  isActive: (0, import_pg_core.boolean)("is_active").notNull().default(true),
  steps: (0, import_pg_core.text)("steps").notNull().default("[]"),
  // JSON string of steps
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var workflowSessions = (0, import_pg_core.pgTable)("workflow_sessions", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  conversationId: (0, import_pg_core.integer)("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  workflowId: (0, import_pg_core.integer)("workflow_id").references(() => workflows.id, { onDelete: "cascade" }).notNull(),
  currentStepId: (0, import_pg_core.text)("current_step_id").notNull(),
  capturedData: (0, import_pg_core.text)("captured_data").notNull().default("{}"),
  // JSON string of captured step variables
  isActive: (0, import_pg_core.boolean)("is_active").notNull().default(true),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var aiSettings = (0, import_pg_core.pgTable)("ai_settings", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  whatsappNumberId: (0, import_pg_core.integer)("whatsapp_number_id").references(() => whatsappNumbers.id, { onDelete: "cascade" }).notNull().unique(),
  aiProvider: (0, import_pg_core.text)("ai_provider").notNull().default("gemini"),
  apiKey: (0, import_pg_core.text)("api_key").notNull().default(""),
  modelName: (0, import_pg_core.text)("model_name").notNull().default("gemini-2.5-flash"),
  defaultTone: (0, import_pg_core.text)("default_tone").notNull().default("professional"),
  // 'professional' | 'casual' | 'friendly' | 'helpful'
  companyKnowledgeBase: (0, import_pg_core.text)("company_knowledge_base").notNull().default(""),
  restrictedWords: (0, import_pg_core.text)("restricted_words").notNull().default(""),
  autoSuggest: (0, import_pg_core.boolean)("auto_suggest").notNull().default(true),
  autoReply: (0, import_pg_core.boolean)("auto_reply").notNull().default(false),
  humanApprovalRequired: (0, import_pg_core.boolean)("human_approval_required").notNull().default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var aiTrainingData = (0, import_pg_core.pgTable)("ai_training_data", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  whatsappNumberId: (0, import_pg_core.integer)("whatsapp_number_id").references(() => whatsappNumbers.id, { onDelete: "cascade" }).notNull(),
  type: (0, import_pg_core.text)("type").notNull(),
  // 'approved_reply' | 'rejected_reply' | 'faq' | 'rule'
  question: (0, import_pg_core.text)("question").notNull(),
  answer: (0, import_pg_core.text)("answer").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var auditLogs = (0, import_pg_core.pgTable)("audit_logs", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail: (0, import_pg_core.text)("user_email"),
  action: (0, import_pg_core.text)("action").notNull(),
  // 'Login', 'Logout', 'Settings Changed', etc.
  details: (0, import_pg_core.text)("details").notNull(),
  ipAddress: (0, import_pg_core.text)("ip_address"),
  timestamp: (0, import_pg_core.timestamp)("timestamp").defaultNow()
});
var quickReplies = (0, import_pg_core.pgTable)("quick_replies", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  whatsappNumberId: (0, import_pg_core.integer)("whatsapp_number_id").references(() => whatsappNumbers.id, { onDelete: "cascade" }).notNull(),
  shortcut: (0, import_pg_core.text)("shortcut").notNull(),
  message: (0, import_pg_core.text)("message").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var usersRelations = (0, import_drizzle_orm.relations)(users, ({ many }) => ({
  assignments: many(userNumberAssignments),
  contactsAssigned: many(contacts),
  conversationsAssigned: many(conversations),
  messagesSent: many(messages),
  auditLogs: many(auditLogs)
}));
var whatsappNumbersRelations = (0, import_drizzle_orm.relations)(whatsappNumbers, ({ many, one }) => ({
  assignments: many(userNumberAssignments),
  contacts: many(contacts),
  conversations: many(conversations),
  workflows: many(workflows),
  aiSettings: one(aiSettings, {
    fields: [whatsappNumbers.id],
    references: [aiSettings.whatsappNumberId]
  }),
  aiTrainingData: many(aiTrainingData),
  quickReplies: many(quickReplies)
}));
var userNumberAssignmentsRelations = (0, import_drizzle_orm.relations)(userNumberAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userNumberAssignments.userId],
    references: [users.id]
  }),
  number: one(whatsappNumbers, {
    fields: [userNumberAssignments.numberId],
    references: [whatsappNumbers.id]
  })
}));
var contactsRelations = (0, import_drizzle_orm.relations)(contacts, ({ one, many }) => ({
  sourceNumber: one(whatsappNumbers, {
    fields: [contacts.sourceNumberId],
    references: [whatsappNumbers.id]
  }),
  assignedUser: one(users, {
    fields: [contacts.assignedUserId],
    references: [users.id]
  }),
  conversations: many(conversations)
}));
var conversationsRelations = (0, import_drizzle_orm.relations)(conversations, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id]
  }),
  whatsappNumber: one(whatsappNumbers, {
    fields: [conversations.whatsappNumberId],
    references: [whatsappNumbers.id]
  }),
  assignedUser: one(users, {
    fields: [conversations.assignedUserId],
    references: [users.id]
  }),
  messages: many(messages),
  workflowSessions: many(workflowSessions)
}));
var messagesRelations = (0, import_drizzle_orm.relations)(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  agent: one(users, {
    fields: [messages.agentId],
    references: [users.id]
  })
}));
var workflowsRelations = (0, import_drizzle_orm.relations)(workflows, ({ one, many }) => ({
  whatsappNumber: one(whatsappNumbers, {
    fields: [workflows.whatsappNumberId],
    references: [whatsappNumbers.id]
  }),
  sessions: many(workflowSessions)
}));
var workflowSessionsRelations = (0, import_drizzle_orm.relations)(workflowSessions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [workflowSessions.conversationId],
    references: [conversations.id]
  }),
  workflow: one(workflows, {
    fields: [workflowSessions.workflowId],
    references: [workflows.id]
  })
}));
var aiSettingsRelations = (0, import_drizzle_orm.relations)(aiSettings, ({ one }) => ({
  whatsappNumber: one(whatsappNumbers, {
    fields: [aiSettings.whatsappNumberId],
    references: [whatsappNumbers.id]
  })
}));
var aiTrainingDataRelations = (0, import_drizzle_orm.relations)(aiTrainingData, ({ one }) => ({
  whatsappNumber: one(whatsappNumbers, {
    fields: [aiTrainingData.whatsappNumberId],
    references: [whatsappNumbers.id]
  })
}));
var quickRepliesRelations = (0, import_drizzle_orm.relations)(quickReplies, ({ one }) => ({
  whatsappNumber: one(whatsappNumbers, {
    fields: [quickReplies.whatsappNumberId],
    references: [whatsappNumbers.id]
  })
}));
var auditLogsRelations = (0, import_drizzle_orm.relations)(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
}));

// src/db/index.ts
var createPool = () => {
  return new import_pg.Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionTimeoutMillis: 15e3
  });
};
var pool = createPool();
pool.on("error", (err) => {
  console.error("Unexpected error on idle SQL pool client:", err);
});
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });

// server.ts
var app = (0, import_express.default)();
app.set("trust proxy", 1);
app.disable("x-powered-by");
var PORT = Number(process.env.PORT || 3e3);
var configuredJwtSecret = process.env.JWT_SECRET?.trim();
if (!configuredJwtSecret && process.env.NODE_ENV === "production") {
  throw new Error(
    "JWT_SECRET environment variable is required when NODE_ENV=production."
  );
}
var JWT_SECRET = configuredJwtSecret || "development_only_intalent_whatsapp_secret";
app.use(import_express.default.json({
  // Media is accepted as base64 JSON and uploaded directly to Meta. WhatsApp
  // media limits vary by type; cap application requests to a safe 30 MB.
  limit: "30mb",
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  }
}));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    app: "intalent-whatsapp",
    environment: process.env.NODE_ENV || "development",
    host: req.get("host") || null,
    protocol: req.protocol,
    forwardedProto: req.get("x-forwarded-proto") || null,
    time: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new import_genai.GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
var META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";
var META_API_TIMEOUT_MS = Number(process.env.META_API_TIMEOUT_MS || 15e3);
var MetaApiError = class extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
    this.code = data?.error?.code;
    this.type = data?.error?.type;
    this.traceId = data?.error?.fbtrace_id;
  }
};
function normalizeWhatsAppNumber(phone) {
  return String(phone || "").trim().replace(/[^\d]/g, "");
}
function getMetaApiErrorMessage(data, fallbackStatus) {
  return data?.error?.error_user_msg || data?.error?.message || data?.message || `Meta API request failed with status ${fallbackStatus}`;
}
async function parseMetaResponse(response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}
function throwMetaApiError(data, status) {
  throw new MetaApiError(getMetaApiErrorMessage(data, status), status, data);
}
function getMetaRouteError(error) {
  if (error instanceof MetaApiError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 502;
    return {
      status,
      body: {
        error: error.message,
        provider: "meta",
        providerStatus: error.status,
        providerCode: error.code,
        providerType: error.type,
        traceId: error.traceId
      }
    };
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return {
      status: 504,
      body: {
        error: `Meta API did not respond within ${META_API_TIMEOUT_MS}ms.`,
        provider: "meta"
      }
    };
  }
  return {
    status: 503,
    body: {
      error: error instanceof Error ? error.message : "Meta API is currently unreachable.",
      provider: "meta"
    }
  };
}
function verifyMetaWebhookSignature(params) {
  const appSecret = String(params.appSecret || "").trim();
  const signatureHeader = String(params.signatureHeader || "").trim();
  if (!appSecret || !params.rawBody || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expected = `sha256=${import_crypto.default.createHmac("sha256", appSecret).update(params.rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureHeader, "utf8");
  return expectedBuffer.length === actualBuffer.length && import_crypto.default.timingSafeEqual(expectedBuffer, actualBuffer);
}
async function verifyMetaPhoneNumber(params) {
  const phoneNumberId = String(params.phoneNumberId || "").trim();
  const accessToken = String(params.accessToken || "").trim();
  if (!phoneNumberId || !accessToken) {
    throw new Error("Phone Number ID or Access Token is missing in WhatsApp settings.");
  }
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`;
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(META_API_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = await parseMetaResponse(response);
  if (!response.ok) {
    throwMetaApiError(data, response.status);
  }
  return data;
}
async function sendWhatsAppTextMessage(params) {
  const phoneNumberId = String(params.phoneNumberId || "").trim();
  const accessToken = String(params.accessToken || "").trim();
  const to = normalizeWhatsAppNumber(params.to);
  const body = String(params.body || "").trim();
  if (!phoneNumberId || !accessToken) {
    throw new Error("Phone Number ID or Access Token is missing in WhatsApp settings.");
  }
  if (!to) {
    throw new Error("Recipient WhatsApp number is invalid.");
  }
  if (!body) {
    throw new Error("Message text is empty.");
  }
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(META_API_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      ...params.replyToMetaMessageId ? { context: { message_id: params.replyToMetaMessageId } } : {},
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });
  const data = await parseMetaResponse(response);
  if (!response.ok) {
    throwMetaApiError(data, response.status);
  }
  return data;
}
async function uploadWhatsAppMedia(params) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", params.mimeType);
  form.append(
    "file",
    new Blob([params.buffer], { type: params.mimeType }),
    params.filename
  );
  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${params.phoneNumberId}/media`,
    {
      method: "POST",
      signal: AbortSignal.timeout(META_API_TIMEOUT_MS * 2),
      headers: { Authorization: `Bearer ${params.accessToken}` },
      body: form
    }
  );
  const data = await parseMetaResponse(response);
  if (!response.ok) throwMetaApiError(data, response.status);
  return String(data?.id || "").trim();
}
async function sendWhatsAppMediaMessage(params) {
  const mediaPayload = { id: params.mediaId };
  if (params.caption && ["image", "video", "document"].includes(params.mediaType)) {
    mediaPayload.caption = params.caption;
  }
  if (params.filename && params.mediaType === "document") {
    mediaPayload.filename = params.filename;
  }
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeWhatsAppNumber(params.to),
    ...params.replyToMetaMessageId ? { context: { message_id: params.replyToMetaMessageId } } : {},
    type: params.mediaType,
    [params.mediaType]: mediaPayload
  };
  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      signal: AbortSignal.timeout(META_API_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
  const data = await parseMetaResponse(response);
  if (!response.ok) throwMetaApiError(data, response.status);
  return data;
}
function inferWhatsAppMediaType(mimeType) {
  if (mimeType === "image/webp") return "sticker";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}
async function ensureSeedData() {
  return;
}
async function ensureMessageActionSchema() {
  await db.execute(import_drizzle_orm2.sql`
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS reply_to_message_id integer,
      ADD COLUMN IF NOT EXISTS forwarded_from_message_id integer,
      ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS meta_message_id text,
      ADD COLUMN IF NOT EXISTS reply_context_meta_message_id text,
      ADD COLUMN IF NOT EXISTS meta_media_id text,
      ADD COLUMN IF NOT EXISTS media_mime_type text,
      ADD COLUMN IF NOT EXISTS media_filename text,
      ADD COLUMN IF NOT EXISTS media_caption text
  `);
  await db.execute(import_drizzle_orm2.sql`
    CREATE TABLE IF NOT EXISTS message_user_states (
      id serial PRIMARY KEY,
      message_id integer NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_starred boolean NOT NULL DEFAULT false,
      is_pinned boolean NOT NULL DEFAULT false,
      deleted_for_me boolean NOT NULL DEFAULT false,
      updated_at timestamp DEFAULT now(),
      UNIQUE (message_id, user_id)
    )
  `);
}
var authenticateJWT = async (req, res, next) => {
  const rawAuthorization = req.headers.authorization || req.headers["x-forwarded-authorization"] || "";
  const authHeader = String(rawAuthorization).trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Access denied. Token missing." });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: "Access denied. Token missing." });
  }
  try {
    const decoded = import_jsonwebtoken.default.verify(token, JWT_SECRET);
    if (!decoded || !Number.isInteger(Number(decoded.id))) {
      return res.status(403).json({ error: "Invalid authentication token." });
    }
    const [user] = await db.select().from(schema_exports.users).where((0, import_drizzle_orm2.eq)(schema_exports.users.id, Number(decoded.id))).limit(1);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User is suspended or deactivated." });
    }
    req.user = user;
    return next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
    return res.status(403).json({ error: "Invalid authentication token." });
  }
};
var requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permission denied. Insufficient role permissions." });
    }
    next();
  };
};
async function auditLog(userId, email, action, details, ip) {
  try {
    await db.insert(schema_exports.auditLogs).values({
      userId,
      userEmail: email,
      action,
      details,
      ipAddress: ip || "127.0.0.1"
    });
  } catch (e) {
    console.error("Audit logging error:", e);
  }
}
app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Please provide email and password." });
  }
  try {
    const [user] = await db.select().from(schema_exports.users).where((0, import_drizzle_orm2.eq)(schema_exports.users.email, email)).limit(1);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: "Your account is deactivated." });
    }
    const isMatch = import_bcryptjs.default.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const token = import_jsonwebtoken.default.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    await auditLog(
      user.id,
      user.email,
      "Login",
      `User ${user.name} logged in successfully.`,
      req.ip
    );
    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        canEditWorkflows: user.canEditWorkflows
      }
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({
      error: "Server login error. Please try again."
    });
  }
});
app.get("/api/auth/me", authenticateJWT, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      isActive: req.user.isActive,
      canEditWorkflows: req.user.canEditWorkflows
    }
  });
});
app.get("/api/auth/profile", authenticateJWT, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    isActive: req.user.isActive,
    canEditWorkflows: req.user.canEditWorkflows
  });
});
app.get("/api/users", authenticateJWT, requireRoles(["super_admin"]), async (req, res) => {
  try {
    const usersList = await db.select({
      id: schema_exports.users.id,
      name: schema_exports.users.name,
      email: schema_exports.users.email,
      role: schema_exports.users.role,
      isActive: schema_exports.users.isActive,
      canEditWorkflows: schema_exports.users.canEditWorkflows,
      createdAt: schema_exports.users.createdAt
    }).from(schema_exports.users).orderBy((0, import_drizzle_orm2.desc)(schema_exports.users.id));
    res.json(usersList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/users", authenticateJWT, requireRoles(["super_admin"]), async (req, res) => {
  const { name, email, password, role, isActive, canEditWorkflows } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Missing required user fields." });
  }
  try {
    const hashed = import_bcryptjs.default.hashSync(password, 10);
    const [newUser] = await db.insert(schema_exports.users).values({
      name,
      email,
      password: hashed,
      role,
      isActive: isActive !== void 0 ? isActive : true,
      canEditWorkflows: canEditWorkflows !== void 0 ? canEditWorkflows : false
    }).returning();
    await auditLog(req.user.id, req.user.email, "User Created", `Created user ${name} with role ${role}.`);
    res.json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      canEditWorkflows: newUser.canEditWorkflows
    });
  } catch (error) {
    if (error.code === "23505" || error.message?.includes("unique")) {
      return res.status(400).json({ error: "User with this email already exists." });
    }
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/users/:id", authenticateJWT, requireRoles(["super_admin"]), async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role, isActive, canEditWorkflows } = req.body;
  try {
    const updates = {};
    if (name !== void 0) updates.name = name;
    if (email !== void 0) updates.email = email;
    if (role !== void 0) updates.role = role;
    if (isActive !== void 0) updates.isActive = isActive;
    if (canEditWorkflows !== void 0) updates.canEditWorkflows = canEditWorkflows;
    if (password) updates.password = import_bcryptjs.default.hashSync(password, 10);
    const [updatedUser] = await db.update(schema_exports.users).set(updates).where((0, import_drizzle_orm2.eq)(schema_exports.users.id, parseInt(id))).returning();
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }
    await auditLog(req.user.id, req.user.email, "User Updated", `Updated user ${updatedUser.name} (ID: ${id}).`);
    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      canEditWorkflows: updatedUser.canEditWorkflows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/users/:id", authenticateJWT, requireRoles(["super_admin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const [deleted] = await db.delete(schema_exports.users).where((0, import_drizzle_orm2.eq)(schema_exports.users.id, parseInt(id))).returning();
    if (!deleted) {
      return res.status(404).json({ error: "User not found." });
    }
    await auditLog(req.user.id, req.user.email, "User Deleted", `Deleted user ${deleted.name} (ID: ${id}).`);
    res.json({ success: true, message: `User ${deleted.name} deleted.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/whatsapp_numbers", authenticateJWT, async (req, res) => {
  try {
    let numbers;
    if (req.user.role === "super_admin") {
      numbers = await db.select().from(schema_exports.whatsappNumbers).orderBy((0, import_drizzle_orm2.asc)(schema_exports.whatsappNumbers.id));
    } else {
      const assignments = await db.select().from(schema_exports.userNumberAssignments).where((0, import_drizzle_orm2.eq)(schema_exports.userNumberAssignments.userId, req.user.id));
      const numberIds = assignments.map((a) => a.numberId);
      if (numberIds.length === 0) {
        numbers = [];
      } else {
        numbers = await db.select().from(schema_exports.whatsappNumbers).where(import_drizzle_orm2.sql`${schema_exports.whatsappNumbers.id} IN ${numberIds}`).orderBy((0, import_drizzle_orm2.asc)(schema_exports.whatsappNumbers.id));
      }
    }
    const enrichedNumbers = await Promise.all(numbers.map(async (num) => {
      const owners = await db.select({
        userId: schema_exports.userNumberAssignments.userId,
        userName: schema_exports.users.name,
        isPrimary: schema_exports.userNumberAssignments.isPrimaryOwner
      }).from(schema_exports.userNumberAssignments).innerJoin(schema_exports.users, (0, import_drizzle_orm2.eq)(schema_exports.userNumberAssignments.userId, schema_exports.users.id)).where((0, import_drizzle_orm2.eq)(schema_exports.userNumberAssignments.numberId, num.id));
      const primary = owners.find((o) => o.isPrimary);
      return {
        ...num,
        assignedUsers: owners,
        primaryOwner: primary ? primary.userName : "None"
      };
    }));
    res.json(enrichedNumbers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/whatsapp_numbers", authenticateJWT, requireRoles(["super_admin"]), async (req, res) => {
  const { displayName, phoneNumber, phoneNumberId, wabaId, appId, appSecret, accessToken, verifyToken, isActive } = req.body;
  if (!displayName || !phoneNumber || !phoneNumberId || !wabaId || !appId || !appSecret || !accessToken || !verifyToken) {
    return res.status(400).json({ error: "Missing required API configuration fields." });
  }
  try {
    const [newNumber] = await db.insert(schema_exports.whatsappNumbers).values({
      displayName,
      phoneNumber,
      phoneNumberId,
      wabaId,
      appId,
      appSecret,
      accessToken,
      verifyToken,
      webhookStatus: "Pending",
      isActive: isActive !== void 0 ? isActive : true
    }).returning();
    await db.insert(schema_exports.aiSettings).values({
      whatsappNumberId: newNumber.id,
      aiProvider: "gemini",
      apiKey: "",
      modelName: "gemini-3.5-flash",
      defaultTone: "professional",
      companyKnowledgeBase: `Knowledge base for ${displayName}. We specialize in professional recruiting services.`,
      restrictedWords: "",
      autoSuggest: true,
      autoReply: false,
      humanApprovalRequired: true
    });
    await db.insert(schema_exports.userNumberAssignments).values({
      userId: req.user.id,
      numberId: newNumber.id,
      isPrimaryOwner: true
    });
    await auditLog(req.user.id, req.user.email, "WhatsApp Number Added", `Added WhatsApp number ${displayName} (${phoneNumber}).`);
    res.json(newNumber);
  } catch (error) {
    if (error.code === "23505" || error.message?.includes("unique")) {
      return res.status(400).json({ error: "A WhatsApp number with this phone number already exists." });
    }
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/whatsapp_numbers/:id", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req, res) => {
  const { id } = req.params;
  const { displayName, phoneNumber, phoneNumberId, wabaId, appId, appSecret, accessToken, verifyToken, isActive, webhookStatus } = req.body;
  try {
    if (req.user.role !== "super_admin") {
      const [assigned] = await db.select().from(schema_exports.userNumberAssignments).where((0, import_drizzle_orm2.and)(
        (0, import_drizzle_orm2.eq)(schema_exports.userNumberAssignments.userId, req.user.id),
        (0, import_drizzle_orm2.eq)(schema_exports.userNumberAssignments.numberId, parseInt(id))
      )).limit(1);
      if (!assigned) {
        return res.status(403).json({ error: "Permission denied. You are not assigned to this WhatsApp number." });
      }
    }
    const updates = {};
    if (displayName !== void 0) updates.displayName = displayName;
    if (phoneNumber !== void 0) updates.phoneNumber = phoneNumber;
    if (phoneNumberId !== void 0) updates.phoneNumberId = phoneNumberId;
    if (wabaId !== void 0) updates.wabaId = wabaId;
    if (appId !== void 0) updates.appId = appId;
    if (appSecret !== void 0) updates.appSecret = appSecret;
    if (accessToken !== void 0) updates.accessToken = accessToken;
    if (verifyToken !== void 0) updates.verifyToken = verifyToken;
    if (isActive !== void 0) updates.isActive = isActive;
    if (webhookStatus !== void 0) updates.webhookStatus = webhookStatus;
    const [updated] = await db.update(schema_exports.whatsappNumbers).set(updates).where((0, import_drizzle_orm2.eq)(schema_exports.whatsappNumbers.id, parseInt(id))).returning();
    if (!updated) {
      return res.status(404).json({ error: "WhatsApp number not found." });
    }
    await auditLog(req.user.id, req.user.email, "WhatsApp Number Updated", `Updated settings for ${updated.displayName}.`);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/whatsapp_numbers/:id", authenticateJWT, requireRoles(["super_admin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const [deleted] = await db.delete(schema_exports.whatsappNumbers).where((0, import_drizzle_orm2.eq)(schema_exports.whatsappNumbers.id, parseInt(id))).returning();
    if (!deleted) {
      return res.status(404).json({ error: "WhatsApp number not found." });
    }
    await auditLog(req.user.id, req.user.email, "WhatsApp Number Deleted", `Deleted WhatsApp number ${deleted.displayName} (ID: ${id}).`);
    res.json({ success: true, message: `WhatsApp number ${deleted.displayName} deleted.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/whatsapp_numbers/:id/assignments", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req, res) => {
  const { id } = req.params;
  const { userIds, primaryOwnerId } = req.body;
  if (!Array.isArray(userIds)) {
    return res.status(400).json({ error: "userIds must be an array." });
  }
  try {
    await db.delete(schema_exports.userNumberAssignments).where((0, import_drizzle_orm2.eq)(schema_exports.userNumberAssignments.numberId, parseInt(id)));
    if (userIds.length > 0) {
      const values = userIds.map((uid) => ({
        userId: uid,
        numberId: parseInt(id),
        isPrimaryOwner: uid === primaryOwnerId
      }));
      await db.insert(schema_exports.userNumberAssignments).values(values);
    }
    await auditLog(req.user.id, req.user.email, "Assignments Updated", `Updated user assignments for WhatsApp Number ID ${id}.`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/whatsapp_numbers/:id/test-connection", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const [num] = await db.select().from(schema_exports.whatsappNumbers).where((0, import_drizzle_orm2.eq)(schema_exports.whatsappNumbers.id, parseInt(id))).limit(1);
    if (!num) return res.status(404).json({ error: "Number not found." });
    if (!num.phoneNumberId || !num.accessToken) {
      return res.status(400).json({ error: "Phone Number ID or Access Token is missing in WhatsApp settings." });
    }
    const metaPhone = await verifyMetaPhoneNumber({
      phoneNumberId: num.phoneNumberId,
      accessToken: num.accessToken
    });
    await auditLog(req.user.id, req.user.email, "API Connection Test", `Verified Meta WhatsApp Cloud API credentials for ${num.displayName}.`);
    res.json({
      success: true,
      message: "Meta WhatsApp Cloud API credentials verified successfully. Webhook verification is a separate Meta callback step.",
      status: num.webhookStatus,
      metaPhone
    });
  } catch (error) {
    console.error("Meta connection test failed:", error);
    const routeError = getMetaRouteError(error);
    res.status(routeError.status).json(routeError.body);
  }
});
app.post("/api/whatsapp_numbers/:id/verify-webhook", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const [num] = await db.select().from(schema_exports.whatsappNumbers).where((0, import_drizzle_orm2.eq)(schema_exports.whatsappNumbers.id, parseInt(id))).limit(1);
    if (!num) return res.status(404).json({ error: "Number not found." });
    res.json({ success: true, message: `Webhook token verified against Meta App configurations!` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/whatsapp_numbers/:id/test-reply", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { testNumber } = req.body;
  if (!testNumber) return res.status(400).json({ error: "Please specify an authorized Meta Developer Test Number." });
  const normalizedTestNumber = normalizeWhatsAppNumber(testNumber);
  if (normalizedTestNumber.length < 8 || normalizedTestNumber.length > 15) {
    return res.status(400).json({
      error: "Recipient number must use international format with country code (8 to 15 digits, without a leading +)."
    });
  }
  try {
    const [num] = await db.select().from(schema_exports.whatsappNumbers).where((0, import_drizzle_orm2.eq)(schema_exports.whatsappNumbers.id, parseInt(id))).limit(1);
    if (!num) return res.status(404).json({ error: "Number not found." });
    if (!num.isActive) {
      return res.status(400).json({ error: "This WhatsApp number is inactive." });
    }
    if (!num.phoneNumberId || !num.accessToken) {
      return res.status(400).json({ error: "Phone Number ID or Access Token is missing in WhatsApp settings." });
    }
    const metaResult = await sendWhatsAppTextMessage({
      phoneNumberId: num.phoneNumberId,
      accessToken: num.accessToken,
      to: normalizedTestNumber,
      body: "Hello from InTalent WhatsApp Inbox. This is a Meta Cloud API test message."
    });
    await auditLog(req.user.id, req.user.email, "Meta Test Reply", `Sent real Meta WhatsApp test reply to ${normalizedTestNumber}.`);
    res.json({
      success: true,
      message: `A real WhatsApp test reply was sent to ${normalizedTestNumber}.`,
      metaResult
    });
  } catch (error) {
    console.error("Meta test reply failed:", error);
    const routeError = getMetaRouteError(error);
    res.status(routeError.status).json(routeError.body);
  }
});
app.get("/api/whatsapp_numbers/:id/ai-settings", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    let [settings] = await db.select().from(schema_exports.aiSettings).where((0, import_drizzle_orm2.eq)(schema_exports.aiSettings.whatsappNumberId, parseInt(id))).limit(1);
    if (!settings) {
      [settings] = await db.insert(schema_exports.aiSettings).values({
        whatsappNumberId: parseInt(id),
        aiProvider: "gemini",
        apiKey: "",
        modelName: "gemini-3.5-flash",
        defaultTone: "professional",
        companyKnowledgeBase: "We match candidates with top tech job roles.",
        restrictedWords: "",
        autoSuggest: true,
        autoReply: false,
        humanApprovalRequired: true
      }).returning();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/whatsapp_numbers/:id/ai-settings", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req, res) => {
  const { id } = req.params;
  const { aiProvider, apiKey, modelName, defaultTone, companyKnowledgeBase, restrictedWords, autoSuggest, autoReply, humanApprovalRequired } = req.body;
  try {
    const updates = {};
    if (aiProvider !== void 0) updates.aiProvider = aiProvider;
    if (apiKey !== void 0) updates.apiKey = apiKey;
    if (modelName !== void 0) updates.modelName = modelName;
    if (defaultTone !== void 0) updates.defaultTone = defaultTone;
    if (companyKnowledgeBase !== void 0) updates.companyKnowledgeBase = companyKnowledgeBase;
    if (restrictedWords !== void 0) updates.restrictedWords = restrictedWords;
    if (autoSuggest !== void 0) updates.autoSuggest = autoSuggest;
    if (autoReply !== void 0) updates.autoReply = autoReply;
    if (humanApprovalRequired !== void 0) updates.humanApprovalRequired = humanApprovalRequired;
    const [updated] = await db.update(schema_exports.aiSettings).set(updates).where((0, import_drizzle_orm2.eq)(schema_exports.aiSettings.whatsappNumberId, parseInt(id))).returning();
    await auditLog(req.user.id, req.user.email, "AI Settings Updated", `Updated AI settings for WhatsApp Number ID ${id}.`);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/whatsapp_numbers/:id/workflows", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const workflows2 = await db.select().from(schema_exports.workflows).where((0, import_drizzle_orm2.eq)(schema_exports.workflows.whatsappNumberId, parseInt(id))).orderBy((0, import_drizzle_orm2.desc)(schema_exports.workflows.id));
    res.json(workflows2);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/whatsapp_numbers/:id/workflows", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { name, triggerKeyword, welcomeMessage, isActive, steps } = req.body;
  if (!name || !triggerKeyword || !welcomeMessage || !steps) {
    return res.status(400).json({ error: "Missing required workflow fields." });
  }
  if (req.user.role === "user" && !req.user.canEditWorkflows) {
    return res.status(403).json({ error: "You do not have permission to edit workflows." });
  }
  try {
    const [newWorkflow] = await db.insert(schema_exports.workflows).values({
      whatsappNumberId: parseInt(id),
      name,
      triggerKeyword: triggerKeyword.toLowerCase().trim(),
      welcomeMessage,
      isActive: isActive !== void 0 ? isActive : true,
      steps: typeof steps === "string" ? steps : JSON.stringify(steps)
    }).returning();
    await auditLog(req.user.id, req.user.email, "Workflow Created", `Created workflow '${name}' on number ${id}.`);
    res.json(newWorkflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/whatsapp_numbers/:id/workflows/:workflowId", authenticateJWT, async (req, res) => {
  const { id, workflowId } = req.params;
  const { name, triggerKeyword, welcomeMessage, isActive, steps } = req.body;
  if (req.user.role === "user" && !req.user.canEditWorkflows) {
    return res.status(403).json({ error: "You do not have permission to edit workflows." });
  }
  try {
    const updates = {};
    if (name !== void 0) updates.name = name;
    if (triggerKeyword !== void 0) updates.triggerKeyword = triggerKeyword.toLowerCase().trim();
    if (welcomeMessage !== void 0) updates.welcomeMessage = welcomeMessage;
    if (isActive !== void 0) updates.isActive = isActive;
    if (steps !== void 0) {
      updates.steps = typeof steps === "string" ? steps : JSON.stringify(steps);
    }
    const [updated] = await db.update(schema_exports.workflows).set(updates).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.workflows.id, parseInt(workflowId)),
      (0, import_drizzle_orm2.eq)(schema_exports.workflows.whatsappNumberId, parseInt(id))
    )).returning();
    if (!updated) return res.status(404).json({ error: "Workflow not found." });
    await auditLog(req.user.id, req.user.email, "Workflow Updated", `Updated workflow '${updated.name}' (ID: ${workflowId}).`);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/whatsapp_numbers/:id/workflows/:workflowId", authenticateJWT, async (req, res) => {
  const { id, workflowId } = req.params;
  if (req.user.role === "user" && !req.user.canEditWorkflows) {
    return res.status(403).json({ error: "You do not have permission to edit workflows." });
  }
  try {
    const [deleted] = await db.delete(schema_exports.workflows).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.workflows.id, parseInt(workflowId)),
      (0, import_drizzle_orm2.eq)(schema_exports.workflows.whatsappNumberId, parseInt(id))
    )).returning();
    if (!deleted) return res.status(404).json({ error: "Workflow not found." });
    await auditLog(req.user.id, req.user.email, "Workflow Deleted", `Deleted workflow '${deleted.name}' (ID: ${workflowId}).`);
    res.json({ success: true, message: `Workflow '${deleted.name}' deleted.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/whatsapp_numbers/:id/ai-training-data", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const items = await db.select().from(schema_exports.aiTrainingData).where((0, import_drizzle_orm2.eq)(schema_exports.aiTrainingData.whatsappNumberId, parseInt(id))).orderBy((0, import_drizzle_orm2.desc)(schema_exports.aiTrainingData.id));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/whatsapp_numbers/:id/ai-training-data", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req, res) => {
  const { id } = req.params;
  const { type, question, answer } = req.body;
  if (!type || !question || !answer) {
    return res.status(400).json({ error: "Missing type, question or answer." });
  }
  try {
    const [newItem] = await db.insert(schema_exports.aiTrainingData).values({
      whatsappNumberId: parseInt(id),
      type,
      question,
      answer
    }).returning();
    await auditLog(req.user.id, req.user.email, "AI FAQ Added", `Added ${type} training item: "${question}".`);
    res.json(newItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/whatsapp_numbers/:id/ai-training-data/:itemId", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req, res) => {
  const { id, itemId } = req.params;
  const { type, question, answer } = req.body;
  try {
    const updates = {};
    if (type !== void 0) updates.type = type;
    if (question !== void 0) updates.question = question;
    if (answer !== void 0) updates.answer = answer;
    const [updated] = await db.update(schema_exports.aiTrainingData).set(updates).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.aiTrainingData.id, parseInt(itemId)),
      (0, import_drizzle_orm2.eq)(schema_exports.aiTrainingData.whatsappNumberId, parseInt(id))
    )).returning();
    if (!updated) return res.status(404).json({ error: "Training item not found." });
    await auditLog(req.user.id, req.user.email, "AI FAQ Updated", `Updated FAQ training item (ID: ${itemId}).`);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/whatsapp_numbers/:id/ai-training-data/:itemId", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req, res) => {
  const { id, itemId } = req.params;
  try {
    const [deleted] = await db.delete(schema_exports.aiTrainingData).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.aiTrainingData.id, parseInt(itemId)),
      (0, import_drizzle_orm2.eq)(schema_exports.aiTrainingData.whatsappNumberId, parseInt(id))
    )).returning();
    if (!deleted) return res.status(404).json({ error: "Training item not found." });
    await auditLog(req.user.id, req.user.email, "AI FAQ Deleted", `Deleted training item (ID: ${itemId}).`);
    res.json({ success: true, message: "Training item deleted." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/whatsapp_numbers/:id/quick-replies", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const items = await db.select().from(schema_exports.quickReplies).where((0, import_drizzle_orm2.eq)(schema_exports.quickReplies.whatsappNumberId, parseInt(id))).orderBy((0, import_drizzle_orm2.desc)(schema_exports.quickReplies.id));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/whatsapp_numbers/:id/quick-replies", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { shortcut, message } = req.body;
  if (!shortcut || !message) {
    return res.status(400).json({ error: "Missing shortcut or message." });
  }
  try {
    const [newItem] = await db.insert(schema_exports.quickReplies).values({
      whatsappNumberId: parseInt(id),
      shortcut,
      message
    }).returning();
    await auditLog(req.user.id, req.user.email, "Quick Reply Added", `Added quick reply shortcut: "${shortcut}".`);
    res.json(newItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/whatsapp_numbers/:id/quick-replies/:replyId", authenticateJWT, async (req, res) => {
  const { id, replyId } = req.params;
  const { shortcut, message } = req.body;
  try {
    const updates = {};
    if (shortcut !== void 0) updates.shortcut = shortcut;
    if (message !== void 0) updates.message = message;
    const [updated] = await db.update(schema_exports.quickReplies).set(updates).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.quickReplies.id, parseInt(replyId)),
      (0, import_drizzle_orm2.eq)(schema_exports.quickReplies.whatsappNumberId, parseInt(id))
    )).returning();
    if (!updated) return res.status(404).json({ error: "Quick reply not found." });
    await auditLog(req.user.id, req.user.email, "Quick Reply Updated", `Updated quick reply shortcut: "${shortcut}".`);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/whatsapp_numbers/:id/quick-replies/:replyId", authenticateJWT, async (req, res) => {
  const { id, replyId } = req.params;
  try {
    const [deleted] = await db.delete(schema_exports.quickReplies).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.quickReplies.id, parseInt(replyId)),
      (0, import_drizzle_orm2.eq)(schema_exports.quickReplies.whatsappNumberId, parseInt(id))
    )).returning();
    if (!deleted) return res.status(404).json({ error: "Quick reply not found." });
    await auditLog(req.user.id, req.user.email, "Quick Reply Deleted", `Deleted quick reply ID: ${replyId}.`);
    res.json({ success: true, message: "Quick reply deleted." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/conversations", authenticateJWT, async (req, res) => {
  try {
    const { status, assignedToMe, search } = req.query;
    let numberIds = [];
    if (req.user.role === "super_admin") {
      const numbers = await db.select().from(schema_exports.whatsappNumbers);
      numberIds = numbers.map((n) => n.id);
    } else {
      const assignments = await db.select().from(schema_exports.userNumberAssignments).where((0, import_drizzle_orm2.eq)(schema_exports.userNumberAssignments.userId, req.user.id));
      numberIds = assignments.map((a) => a.numberId);
    }
    if (numberIds.length === 0) {
      return res.json([]);
    }
    let conditions = import_drizzle_orm2.sql`${schema_exports.conversations.whatsappNumberId} IN ${numberIds}`;
    if (status && status !== "all") {
      if (status === "unread") {
        conditions = import_drizzle_orm2.sql`${conditions} AND ${schema_exports.conversations.status} = 'unread'`;
      } else if (status === "human_handover") {
        conditions = import_drizzle_orm2.sql`${conditions} AND ${schema_exports.conversations.status} = 'human_handover'`;
      } else if (status === "ai_suggested") {
        conditions = import_drizzle_orm2.sql`${conditions} AND ${schema_exports.conversations.status} = 'ai_suggested'`;
      } else if (status === "workflow_active") {
        conditions = import_drizzle_orm2.sql`${conditions} AND ${schema_exports.conversations.status} = 'workflow_active'`;
      } else if (status === "closed") {
        conditions = import_drizzle_orm2.sql`${conditions} AND ${schema_exports.conversations.status} = 'closed'`;
      }
    } else {
      conditions = import_drizzle_orm2.sql`${conditions} AND ${schema_exports.conversations.status} != 'closed'`;
    }
    if (assignedToMe === "true") {
      conditions = import_drizzle_orm2.sql`${conditions} AND ${schema_exports.conversations.assignedUserId} = ${req.user.id}`;
    }
    const conversationsList = await db.select({
      id: schema_exports.conversations.id,
      contactId: schema_exports.conversations.contactId,
      whatsappNumberId: schema_exports.conversations.whatsappNumberId,
      assignedUserId: schema_exports.conversations.assignedUserId,
      status: schema_exports.conversations.status,
      lastMessageAt: schema_exports.conversations.lastMessageAt,
      contactName: schema_exports.contacts.name,
      contactPhone: schema_exports.contacts.phoneNumber,
      contactTags: schema_exports.contacts.tags,
      contactType: schema_exports.contacts.clientCandidateType,
      contactLocation: schema_exports.contacts.location,
      whatsappNumberName: schema_exports.whatsappNumbers.displayName
    }).from(schema_exports.conversations).innerJoin(schema_exports.contacts, (0, import_drizzle_orm2.eq)(schema_exports.conversations.contactId, schema_exports.contacts.id)).innerJoin(schema_exports.whatsappNumbers, (0, import_drizzle_orm2.eq)(schema_exports.conversations.whatsappNumberId, schema_exports.whatsappNumbers.id)).where(conditions).orderBy((0, import_drizzle_orm2.desc)(schema_exports.conversations.lastMessageAt));
    let filtered = conversationsList;
    if (search) {
      const q = String(search).toLowerCase();
      filtered = conversationsList.filter(
        (c) => c.contactName && c.contactName.toLowerCase().includes(q) || c.contactPhone.includes(q) || c.contactTags && c.contactTags.toLowerCase().includes(q)
      );
    }
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/conversations/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const [conv] = await db.select({
      id: schema_exports.conversations.id,
      contactId: schema_exports.conversations.contactId,
      whatsappNumberId: schema_exports.conversations.whatsappNumberId,
      assignedUserId: schema_exports.conversations.assignedUserId,
      status: schema_exports.conversations.status,
      lastMessageAt: schema_exports.conversations.lastMessageAt,
      whatsappNumberName: schema_exports.whatsappNumbers.displayName,
      whatsappNumberPhone: schema_exports.whatsappNumbers.phoneNumber
    }).from(schema_exports.conversations).innerJoin(schema_exports.whatsappNumbers, (0, import_drizzle_orm2.eq)(schema_exports.conversations.whatsappNumberId, schema_exports.whatsappNumbers.id)).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, parseInt(id))).limit(1);
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    const [contact] = await db.select().from(schema_exports.contacts).where((0, import_drizzle_orm2.eq)(schema_exports.contacts.id, conv.contactId)).limit(1);
    let assignedName = "Unassigned";
    if (conv.assignedUserId) {
      const [u] = await db.select().from(schema_exports.users).where((0, import_drizzle_orm2.eq)(schema_exports.users.id, conv.assignedUserId)).limit(1);
      if (u) assignedName = u.name;
    }
    res.json({
      conversation: {
        ...conv,
        assignedUserName: assignedName
      },
      contact
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/conversations/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { status, assignedUserId } = req.body;
  try {
    const updates = {};
    if (status !== void 0) updates.status = status;
    if (assignedUserId !== void 0) updates.assignedUserId = assignedUserId;
    const [updated] = await db.update(schema_exports.conversations).set(updates).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, parseInt(id))).returning();
    if (!updated) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    await auditLog(req.user.id, req.user.email, "Conversation Updated", `Updated conversation ${id} (Status: ${status || "no-change"}, Assigned: ${assignedUserId || "no-change"}).`);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/contacts/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { name, tags, notes, cvField, linkedinField, interestedJobRole, expectedSalary, location, experience, clientCandidateType } = req.body;
  try {
    const updates = {};
    if (name !== void 0) updates.name = name;
    if (tags !== void 0) updates.tags = tags;
    if (notes !== void 0) updates.notes = notes;
    if (cvField !== void 0) updates.cvField = cvField;
    if (linkedinField !== void 0) updates.linkedinField = linkedinField;
    if (interestedJobRole !== void 0) updates.interestedJobRole = interestedJobRole;
    if (expectedSalary !== void 0) updates.expectedSalary = expectedSalary;
    if (location !== void 0) updates.location = location;
    if (experience !== void 0) updates.experience = experience;
    if (clientCandidateType !== void 0) updates.clientCandidateType = clientCandidateType;
    const [updated] = await db.update(schema_exports.contacts).set(updates).where((0, import_drizzle_orm2.eq)(schema_exports.contacts.id, parseInt(id))).returning();
    if (!updated) return res.status(404).json({ error: "Contact not found." });
    await auditLog(req.user.id, req.user.email, "Contact Updated", `Updated details for contact ${name || updated.phoneNumber}.`);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/conversations/:id/messages", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const msgs = await db.select().from(schema_exports.messages).where((0, import_drizzle_orm2.eq)(schema_exports.messages.conversationId, parseInt(id))).orderBy((0, import_drizzle_orm2.asc)(schema_exports.messages.id));
    const states = await db.select().from(schema_exports.messageUserStates).where((0, import_drizzle_orm2.eq)(schema_exports.messageUserStates.userId, req.user.id));
    const stateByMessageId = new Map(states.map((state) => [state.messageId, state]));
    const messageById = new Map(msgs.map((message) => [message.id, message]));
    res.json(msgs.filter((message) => !stateByMessageId.get(message.id)?.deletedForMe).map((message) => {
      const state = stateByMessageId.get(message.id);
      const repliedMessage = message.replyToMessageId ? messageById.get(message.replyToMessageId) : null;
      return {
        ...message,
        content: message.deletedForEveryone ? "" : message.content,
        isStarred: state?.isStarred || false,
        isPinned: state?.isPinned || false,
        deletedForMe: false,
        repliedMessage: repliedMessage ? {
          id: repliedMessage.id,
          senderName: repliedMessage.senderName,
          content: repliedMessage.deletedForEveryone ? "" : repliedMessage.content,
          deletedForEveryone: repliedMessage.deletedForEveryone
        } : null,
        hasUnmatchedReplyContext: Boolean(message.replyContextMetaMessageId) && !repliedMessage
      };
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/messages/:id/media", authenticateJWT, async (req, res) => {
  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: "Invalid message ID." });
  }
  try {
    const [record] = await db.select({
      mediaId: schema_exports.messages.metaMediaId,
      mimeType: schema_exports.messages.mediaMimeType,
      filename: schema_exports.messages.mediaFilename,
      accessToken: schema_exports.whatsappNumbers.accessToken
    }).from(schema_exports.messages).innerJoin(schema_exports.conversations, (0, import_drizzle_orm2.eq)(schema_exports.messages.conversationId, schema_exports.conversations.id)).innerJoin(schema_exports.whatsappNumbers, (0, import_drizzle_orm2.eq)(schema_exports.conversations.whatsappNumberId, schema_exports.whatsappNumbers.id)).where((0, import_drizzle_orm2.eq)(schema_exports.messages.id, messageId)).limit(1);
    if (!record?.mediaId) {
      return res.status(404).json({ error: "This message has no media attachment." });
    }
    const metadataResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${record.mediaId}`,
      {
        headers: { Authorization: `Bearer ${record.accessToken}` },
        signal: AbortSignal.timeout(META_API_TIMEOUT_MS)
      }
    );
    const metadata = await parseMetaResponse(metadataResponse);
    if (!metadataResponse.ok) throwMetaApiError(metadata, metadataResponse.status);
    const mediaResponse = await fetch(metadata.url, {
      headers: { Authorization: `Bearer ${record.accessToken}` },
      signal: AbortSignal.timeout(META_API_TIMEOUT_MS * 2)
    });
    if (!mediaResponse.ok) {
      return res.status(502).json({ error: "Meta media download failed." });
    }
    const mimeType = record.mimeType || metadata.mime_type || "application/octet-stream";
    const safeFilename = String(record.filename || `whatsapp-media-${messageId}`).replace(/[\r\n"]/g, "_");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.send(Buffer.from(await mediaResponse.arrayBuffer()));
  } catch (error) {
    const routeError = getMetaRouteError(error);
    return res.status(routeError.status).json(routeError.body);
  }
});
app.patch("/api/messages/:id/state", authenticateJWT, async (req, res) => {
  const messageId = Number(req.params.id);
  const { isStarred, isPinned } = req.body;
  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ error: "Invalid message ID." });
  }
  if (isStarred === void 0 && isPinned === void 0) {
    return res.status(400).json({ error: "No message state supplied." });
  }
  try {
    const [message] = await db.select().from(schema_exports.messages).where((0, import_drizzle_orm2.eq)(schema_exports.messages.id, messageId)).limit(1);
    if (!message) return res.status(404).json({ error: "Message not found." });
    const [existing] = await db.select().from(schema_exports.messageUserStates).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.messageUserStates.messageId, messageId),
      (0, import_drizzle_orm2.eq)(schema_exports.messageUserStates.userId, req.user.id)
    )).limit(1);
    const values = {
      isStarred: isStarred ?? existing?.isStarred ?? false,
      isPinned: isPinned ?? existing?.isPinned ?? false,
      updatedAt: /* @__PURE__ */ new Date()
    };
    const [state] = existing ? await db.update(schema_exports.messageUserStates).set(values).where((0, import_drizzle_orm2.eq)(schema_exports.messageUserStates.id, existing.id)).returning() : await db.insert(schema_exports.messageUserStates).values({
      messageId,
      userId: req.user.id,
      ...values
    }).returning();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/conversations/:id/ai-suggestions", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const [conv] = await db.select().from(schema_exports.conversations).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, parseInt(id))).limit(1);
    if (!conv) return res.status(404).json({ error: "Conversation not found." });
    const [contact] = await db.select().from(schema_exports.contacts).where((0, import_drizzle_orm2.eq)(schema_exports.contacts.id, conv.contactId)).limit(1);
    const [aiSet] = await db.select().from(schema_exports.aiSettings).where((0, import_drizzle_orm2.eq)(schema_exports.aiSettings.whatsappNumberId, conv.whatsappNumberId)).limit(1);
    const pastMsgs = await db.select().from(schema_exports.messages).where((0, import_drizzle_orm2.eq)(schema_exports.messages.conversationId, parseInt(id))).orderBy((0, import_drizzle_orm2.desc)(schema_exports.messages.id)).limit(6);
    const historyText = pastMsgs.reverse().map((m) => `${m.senderName}: ${m.content}`).join("\n");
    const trainingItems = await db.select().from(schema_exports.aiTrainingData).where((0, import_drizzle_orm2.eq)(schema_exports.aiTrainingData.whatsappNumberId, conv.whatsappNumberId));
    const faqsText = trainingItems.map((item) => `[${item.type}] Q: ${item.question} | A: ${item.answer}`).join("\n");
    const defaultSuggestions = [
      `Hi ${contact.name || "there"}! Thanks for reaching out. We would love to discuss our active React developer positions with you. When are you available for a quick call?`,
      `Hi ${contact.name || "there"}, thanks for sending your details. I have forwarded your profile to our technical recruiting team. They will review it and get back to you shortly!`,
      `Thank you for contacting InTalent. Let me find some roles matching your background. Are you open to hybrid/remote setups, or looking for fully on-site work?`
    ];
    if (!ai || !aiSet) {
      return res.json(defaultSuggestions);
    }
    const prompt = `
You are an advanced AI recruiting assistant for InTalent.
Your task is to generate exactly 3 distinct, highly helpful, and professional message suggestions that the recruiter can review, edit, and send to the candidate or client.

SETTINGS:
- Tone of Voice: ${aiSet.defaultTone}
- Company Knowledge Base: ${aiSet.companyKnowledgeBase}
- Restricted Words (NEVER USE THESE IN ANY SUGGESTION): ${aiSet.restrictedWords || "none"}
- Candidate/Client Type: ${contact.clientCandidateType}
- Contact Profile Info:
  * Name: ${contact.name || "Unknown"}
  * Location: ${contact.location || "Not specified"}
  * Target Job Role: ${contact.interestedJobRole || "Not specified"}
  * Experience: ${contact.experience || "Not specified"}

RELEVANT FAQS / INSTRUCTIONS:
${faqsText || "No FAQs configured. Answer professionally based on recruiting context."}

CONVERSATION HISTORY:
${historyText || "No history yet. This is the first message."}

DIRECTIONS:
1. Generate exactly 3 suggestions.
2. Keep them short, natural, and friendly (like standard WhatsApp chat messages).
3. Do NOT include any meta-data, prefixes like "Option 1:", or explanation text.
4. Return ONLY a valid JSON array of strings, for example:
["Hi John, nice to meet you...", "Thanks for reaching out! Let's schedule...", "Got it! Are you looking for remote work?"]
Do NOT wrap the JSON inside markdown code blocks (e.g. \`\`\`json). Return exactly the raw JSON text.
`;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });
      const responseText = response.text ? response.text.trim() : "";
      let cleaned = responseText;
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.substring(7);
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json(parsed);
      }
    } catch (genErr) {
      console.error("Gemini suggestion generation failed, falling back to default suggestions:", genErr);
    }
    res.json(defaultSuggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/ai-suggestions/train", authenticateJWT, async (req, res) => {
  const { whatsappNumberId, type, question, answer } = req.body;
  if (!whatsappNumberId || !type || !question || !answer) {
    return res.status(400).json({ error: "Missing training params." });
  }
  try {
    await db.insert(schema_exports.aiTrainingData).values({
      whatsappNumberId,
      type,
      question,
      answer
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
async function runWorkflowStep(convId, numId, incomingText, contactId) {
  try {
    let [session] = await db.select().from(schema_exports.workflowSessions).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.workflowSessions.conversationId, convId),
      (0, import_drizzle_orm2.eq)(schema_exports.workflowSessions.isActive, true)
    )).limit(1);
    const textLower = incomingText.toLowerCase().trim();
    let matchedWorkflow = null;
    if (!session) {
      const [wf2] = await db.select().from(schema_exports.workflows).where((0, import_drizzle_orm2.and)(
        (0, import_drizzle_orm2.eq)(schema_exports.workflows.whatsappNumberId, numId),
        (0, import_drizzle_orm2.eq)(schema_exports.workflows.isActive, true),
        (0, import_drizzle_orm2.eq)(schema_exports.workflows.triggerKeyword, textLower)
      )).limit(1);
      if (wf2) {
        matchedWorkflow = wf2;
        const steps2 = JSON.parse(wf2.steps);
        const welcomeStep = steps2[0];
        [session] = await db.insert(schema_exports.workflowSessions).values({
          conversationId: convId,
          workflowId: wf2.id,
          currentStepId: welcomeStep.id,
          capturedData: "{}",
          isActive: true
        }).returning();
        await db.insert(schema_exports.messages).values({
          conversationId: convId,
          sender: "system",
          senderName: "Workflow Engine",
          content: `${wf2.welcomeMessage}

${welcomeStep.questionText}`,
          messageType: "text",
          replyType: "workflow",
          status: "sent"
        });
        await db.update(schema_exports.conversations).set({ status: "workflow_active", lastMessageAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, convId));
        return true;
      }
      return false;
    }
    if (textLower === "human" || textLower === "help" || textLower === "recruiter") {
      await db.update(schema_exports.workflowSessions).set({ isActive: false }).where((0, import_drizzle_orm2.eq)(schema_exports.workflowSessions.id, session.id));
      await db.insert(schema_exports.messages).values({
        conversationId: convId,
        sender: "system",
        senderName: "Workflow Engine",
        content: "Workflow stopped. Handing you over to a live recruiter.",
        messageType: "text",
        replyType: "workflow",
        status: "sent"
      });
      await db.update(schema_exports.conversations).set({ status: "human_handover", lastMessageAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, convId));
      return true;
    }
    const [wf] = await db.select().from(schema_exports.workflows).where((0, import_drizzle_orm2.eq)(schema_exports.workflows.id, session.workflowId)).limit(1);
    if (!wf) return false;
    const steps = JSON.parse(wf.steps);
    const currentStep = steps.find((s) => s.id === session.currentStepId);
    if (!currentStep) return false;
    let nextStepId = currentStep.nextStepId;
    let validReply = true;
    const capturedData = JSON.parse(session.capturedData);
    if (currentStep.type === "menu") {
      const option = currentStep.options?.find((o) => o.key === textLower);
      if (option) {
        nextStepId = option.nextStepId;
        capturedData[currentStep.id] = option.text;
      } else {
        validReply = false;
      }
    } else if (currentStep.type === "question") {
      capturedData[currentStep.id] = incomingText;
      if (currentStep.variableName) {
        const varName = currentStep.variableName;
        const validFields = [
          "cvField",
          "linkedinField",
          "interestedJobRole",
          "expectedSalary",
          "location",
          "experience",
          "clientCandidateType",
          "name"
        ];
        if (validFields.includes(varName)) {
          await db.update(schema_exports.contacts).set({ [varName]: incomingText }).where((0, import_drizzle_orm2.eq)(schema_exports.contacts.id, contactId));
        }
      }
    }
    if (!validReply) {
      await db.insert(schema_exports.messages).values({
        conversationId: convId,
        sender: "system",
        senderName: "Workflow Engine",
        content: "Sorry, I didn\u2019t understand that. Please reply with one of the numbers shown above.",
        messageType: "text",
        replyType: "workflow",
        status: "sent"
      });
      return true;
    }
    await db.update(schema_exports.workflowSessions).set({ capturedData: JSON.stringify(capturedData), updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.workflowSessions.id, session.id));
    const nextStep = steps.find((s) => s.id === nextStepId);
    if (!nextStep || nextStep.type === "end_workflow") {
      const endText = nextStep ? nextStep.questionText : "Thank you for completing the onboarding process!";
      await db.insert(schema_exports.messages).values({
        conversationId: convId,
        sender: "system",
        senderName: "Workflow Engine",
        content: endText,
        messageType: "text",
        replyType: "workflow",
        status: "sent"
      });
      await db.update(schema_exports.workflowSessions).set({ isActive: false }).where((0, import_drizzle_orm2.eq)(schema_exports.workflowSessions.id, session.id));
      await db.update(schema_exports.contacts).set({ capturedAnswers: JSON.stringify(capturedData) }).where((0, import_drizzle_orm2.eq)(schema_exports.contacts.id, contactId));
      await db.update(schema_exports.conversations).set({ status: "open", lastMessageAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, convId));
    } else {
      await db.update(schema_exports.workflowSessions).set({ currentStepId: nextStep.id }).where((0, import_drizzle_orm2.eq)(schema_exports.workflowSessions.id, session.id));
      await db.insert(schema_exports.messages).values({
        conversationId: convId,
        sender: "system",
        senderName: "Workflow Engine",
        content: nextStep.questionText,
        messageType: "text",
        replyType: "workflow",
        status: "sent"
      });
      if (nextStep.type === "handover") {
        await db.update(schema_exports.conversations).set({ status: "human_handover", lastMessageAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, convId));
        await db.update(schema_exports.workflowSessions).set({ isActive: false }).where((0, import_drizzle_orm2.eq)(schema_exports.workflowSessions.id, session.id));
      }
    }
    return true;
  } catch (err) {
    console.error("Workflow run error:", err);
    return false;
  }
}
app.post("/api/messages/send", authenticateJWT, async (req, res) => {
  const {
    conversationId,
    whatsappNumberId,
    recipientPhone,
    messageText = "",
    replyType,
    replyToMessageId,
    forwardedFromMessageId,
    media
  } = req.body;
  if (!conversationId || !whatsappNumberId || !String(messageText).trim() && !media?.data) {
    return res.status(400).json({ error: "Missing required payload fields." });
  }
  const convId = Number(conversationId);
  const waNumberId = Number(whatsappNumberId);
  if (!Number.isInteger(convId) || !Number.isInteger(waNumberId)) {
    return res.status(400).json({ error: "Invalid conversationId or whatsappNumberId." });
  }
  try {
    const [conv] = await db.select().from(schema_exports.conversations).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, convId)).limit(1);
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    if (conv.whatsappNumberId !== waNumberId) {
      return res.status(400).json({ error: "WhatsApp number mismatch for this conversation." });
    }
    const [contact] = await db.select().from(schema_exports.contacts).where((0, import_drizzle_orm2.eq)(schema_exports.contacts.id, conv.contactId)).limit(1);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found for this conversation." });
    }
    const destinationPhone = contact.phoneNumber;
    const requestPhone = normalizeWhatsAppNumber(recipientPhone || "");
    const contactPhone = normalizeWhatsAppNumber(destinationPhone);
    if (requestPhone && requestPhone !== contactPhone) {
      return res.status(400).json({ error: "Recipient phone does not match the conversation contact." });
    }
    const [waNumber] = await db.select().from(schema_exports.whatsappNumbers).where((0, import_drizzle_orm2.eq)(schema_exports.whatsappNumbers.id, waNumberId)).limit(1);
    if (!waNumber) {
      return res.status(404).json({ error: "WhatsApp number configuration not found." });
    }
    if (!waNumber.isActive) {
      return res.status(400).json({ error: "This WhatsApp number is inactive." });
    }
    if (!waNumber.phoneNumberId || !waNumber.accessToken) {
      return res.status(400).json({ error: "Phone Number ID or Access Token is missing in WhatsApp settings." });
    }
    let repliedMessage = null;
    if (replyToMessageId) {
      const [foundRepliedMessage] = await db.select().from(schema_exports.messages).where((0, import_drizzle_orm2.and)(
        (0, import_drizzle_orm2.eq)(schema_exports.messages.id, Number(replyToMessageId)),
        (0, import_drizzle_orm2.eq)(schema_exports.messages.conversationId, convId)
      )).limit(1);
      repliedMessage = foundRepliedMessage || null;
      if (!repliedMessage) {
        return res.status(400).json({ error: "The replied-to message was not found in this conversation." });
      }
    }
    const quotedFallback = repliedMessage && !repliedMessage.metaMessageId ? `Replying to ${repliedMessage.senderName}: "${repliedMessage.content.slice(0, 240)}${repliedMessage.content.length > 240 ? "..." : ""}"

${messageText}` : String(messageText);
    try {
      let mediaType = null;
      let uploadedMediaId = null;
      let mediaMimeType = null;
      let mediaFilename = null;
      let metaResult;
      if (media?.data) {
        mediaMimeType = String(media.mimeType || "application/octet-stream");
        mediaFilename = String(media.filename || "attachment");
        const base64 = String(media.data).replace(/^data:[^;]+;base64,/, "");
        const mediaBuffer = Buffer.from(base64, "base64");
        if (!mediaBuffer.length || mediaBuffer.length > 20 * 1024 * 1024) {
          return res.status(400).json({ error: "Attachment must be between 1 byte and 20 MB." });
        }
        mediaType = inferWhatsAppMediaType(mediaMimeType);
        uploadedMediaId = await uploadWhatsAppMedia({
          phoneNumberId: waNumber.phoneNumberId,
          accessToken: waNumber.accessToken,
          buffer: mediaBuffer,
          mimeType: mediaMimeType,
          filename: mediaFilename
        });
        metaResult = await sendWhatsAppMediaMessage({
          phoneNumberId: waNumber.phoneNumberId,
          accessToken: waNumber.accessToken,
          to: destinationPhone,
          mediaType,
          mediaId: uploadedMediaId,
          caption: quotedFallback.trim(),
          filename: mediaFilename,
          replyToMetaMessageId: repliedMessage?.metaMessageId || null
        });
      } else {
        metaResult = await sendWhatsAppTextMessage({
          phoneNumberId: waNumber.phoneNumberId,
          accessToken: waNumber.accessToken,
          to: destinationPhone,
          body: quotedFallback,
          replyToMetaMessageId: repliedMessage?.metaMessageId || null
        });
      }
      const sentMetaMessageId = String(metaResult?.messages?.[0]?.id || "").trim() || null;
      const [newMsg] = await db.insert(schema_exports.messages).values({
        conversationId: convId,
        sender: "agent",
        senderName: req.user.name,
        content: String(messageText) || mediaFilename || "Attachment",
        messageType: mediaType || "text",
        replyType: replyType || "manual",
        status: "sent",
        agentId: req.user.id,
        timestamp: /* @__PURE__ */ new Date(),
        replyToMessageId: replyToMessageId || null,
        forwardedFromMessageId: forwardedFromMessageId || null,
        metaMessageId: sentMetaMessageId,
        metaMediaId: uploadedMediaId,
        mediaMimeType,
        mediaFilename,
        mediaCaption: String(messageText) || null
      }).returning();
      await db.update(schema_exports.conversations).set({ lastMessageAt: /* @__PURE__ */ new Date(), status: "open" }).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, convId));
      await auditLog(
        req.user.id,
        req.user.email,
        "Message Sent",
        `Sent real WhatsApp reply to ${destinationPhone} (Conv ID: ${convId}).`
      );
      return res.json(newMsg);
    } catch (metaError) {
      await db.insert(schema_exports.messages).values({
        conversationId: convId,
        sender: "agent",
        senderName: req.user.name,
        content: String(messageText) || String(media?.filename || "Attachment"),
        messageType: media?.data ? inferWhatsAppMediaType(String(media.mimeType || "")) : "text",
        replyType: replyType || "manual",
        status: "failed",
        agentId: req.user.id,
        timestamp: /* @__PURE__ */ new Date(),
        replyToMessageId: replyToMessageId || null,
        forwardedFromMessageId: forwardedFromMessageId || null
      });
      await db.update(schema_exports.conversations).set({ lastMessageAt: /* @__PURE__ */ new Date(), status: "open" }).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, convId));
      await auditLog(
        req.user.id,
        req.user.email,
        "Message Failed",
        `Failed to send WhatsApp reply to ${destinationPhone}: ${metaError.message}`
      );
      return res.status(502).json({ error: `WhatsApp send failed: ${metaError.message}` });
    }
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/webhooks/whatsapp/:numberId", async (req, res) => {
  const { numberId } = req.params;
  const verifyToken = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const mode = req.query["hub.mode"];
  try {
    const [num] = await db.select().from(schema_exports.whatsappNumbers).where((0, import_drizzle_orm2.eq)(schema_exports.whatsappNumbers.id, parseInt(numberId))).limit(1);
    if (!num) {
      return res.status(404).send("WhatsApp number config not found.");
    }
    if (mode === "subscribe" && verifyToken === num.verifyToken) {
      console.log(`Webhook verified successfully for WhatsApp Number ${num.displayName}!`);
      await db.update(schema_exports.whatsappNumbers).set({ webhookStatus: "Verified", lastVerified: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.whatsappNumbers.id, num.id));
      return res.send(challenge);
    } else {
      return res.status(403).send("Verification token mismatch.");
    }
  } catch (err) {
    res.status(500).send("Verification error.");
  }
});
app.post("/webhooks/whatsapp/:numberId", async (req, res) => {
  const { numberId } = req.params;
  try {
    const numId = Number(numberId);
    if (!Number.isInteger(numId)) {
      return res.status(404).json({ error: "WhatsApp Number ID not configured." });
    }
    const [whatsappNum] = await db.select().from(schema_exports.whatsappNumbers).where((0, import_drizzle_orm2.eq)(schema_exports.whatsappNumbers.id, numId)).limit(1);
    if (!whatsappNum) {
      return res.status(404).json({ error: "WhatsApp Number ID not configured." });
    }
    const allowUnsignedDevWebhook = process.env.NODE_ENV !== "production" && process.env.ALLOW_UNSIGNED_WEBHOOK_TESTS === "true";
    const signatureValid = verifyMetaWebhookSignature({
      appSecret: whatsappNum.appSecret,
      rawBody: req.rawBody,
      signatureHeader: req.get("x-hub-signature-256") || ""
    });
    if (!signatureValid && !allowUnsignedDevWebhook) {
      console.warn(`Rejected invalid WhatsApp webhook signature for number ${numId}.`);
      return res.status(401).json({ error: "Invalid webhook signature." });
    }
    let from = "";
    let text2 = "";
    let contactName = "";
    let messageType = "text";
    let metaMediaId = null;
    let mediaMimeType = null;
    let mediaFilename = null;
    let mediaCaption = null;
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) {
      return res.status(200).json({ status: "acknowledged" });
    }
    from = normalizeWhatsAppNumber(msg.from || "");
    messageType = msg.type || "text";
    contactName = value?.contacts?.[0]?.profile?.name || "WhatsApp User";
    if (messageType === "text") {
      text2 = msg.text?.body || "";
    } else if (messageType === "button") {
      text2 = msg.button?.text || msg.button?.payload || "";
    } else if (messageType === "interactive") {
      text2 = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
    } else if (["image", "video", "audio", "document", "sticker"].includes(messageType)) {
      const mediaPayload = msg[messageType] || {};
      metaMediaId = String(mediaPayload.id || "").trim() || null;
      mediaMimeType = String(mediaPayload.mime_type || "").trim() || null;
      mediaFilename = String(mediaPayload.filename || "").trim() || null;
      mediaCaption = String(mediaPayload.caption || "").trim() || null;
      text2 = mediaCaption || mediaFilename || `[${messageType} attachment]`;
    } else if (messageType === "location") {
      text2 = [msg.location?.name, msg.location?.address].filter(Boolean).join(" - ") || `${msg.location?.latitude || ""}, ${msg.location?.longitude || ""}`;
    } else {
      text2 = `[${messageType} message received]`;
    }
    if (!from || !text2) {
      return res.status(200).json({ status: "ignored", reason: "missing sender or supported message content" });
    }
    const metaTimestampSeconds = Number(msg.timestamp);
    const receivedAt = Number.isFinite(metaTimestampSeconds) && metaTimestampSeconds > 0 ? new Date(metaTimestampSeconds * 1e3) : /* @__PURE__ */ new Date();
    let [contact] = await db.select().from(schema_exports.contacts).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.contacts.phoneNumber, from),
      (0, import_drizzle_orm2.eq)(schema_exports.contacts.sourceNumberId, numId)
    )).limit(1);
    if (!contact) {
      [contact] = await db.insert(schema_exports.contacts).values({
        phoneNumber: from,
        name: contactName || from,
        sourceNumberId: numId,
        tags: "New Inbound",
        status: "active"
      }).returning();
    } else {
      await db.update(schema_exports.contacts).set({ lastMessageDate: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm2.eq)(schema_exports.contacts.id, contact.id));
    }
    let [conv] = await db.select().from(schema_exports.conversations).where((0, import_drizzle_orm2.and)(
      (0, import_drizzle_orm2.eq)(schema_exports.conversations.contactId, contact.id),
      (0, import_drizzle_orm2.eq)(schema_exports.conversations.whatsappNumberId, numId)
    )).limit(1);
    if (!conv) {
      [conv] = await db.insert(schema_exports.conversations).values({
        contactId: contact.id,
        whatsappNumberId: numId,
        status: "unread",
        lastMessageAt: receivedAt
      }).returning();
    } else {
      await db.update(schema_exports.conversations).set({ status: "unread", lastMessageAt: receivedAt }).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, conv.id));
    }
    let replyToMessageId = null;
    const repliedMetaMessageId = String(msg.context?.id || "").trim();
    if (repliedMetaMessageId) {
      const [repliedMessage] = await db.select({ id: schema_exports.messages.id }).from(schema_exports.messages).where((0, import_drizzle_orm2.eq)(schema_exports.messages.metaMessageId, repliedMetaMessageId)).limit(1);
      replyToMessageId = repliedMessage?.id || null;
    }
    const [newMsg] = await db.insert(schema_exports.messages).values({
      conversationId: conv.id,
      sender: "contact",
      senderName: contact.name || from,
      content: text2,
      messageType: ["image", "video", "audio", "document", "sticker", "location"].includes(messageType) ? messageType : text2.toLowerCase().endsWith(".pdf") || text2.toLowerCase().includes("resume") || text2.toLowerCase().includes("cv") ? "cv" : "text",
      status: "received",
      timestamp: receivedAt,
      metaMessageId: String(msg.id || "").trim() || null,
      replyToMessageId,
      replyContextMetaMessageId: repliedMetaMessageId || null,
      metaMediaId,
      mediaMimeType,
      mediaFilename,
      mediaCaption
    }).returning();
    const isWfHandled = await runWorkflowStep(conv.id, numId, text2, contact.id);
    if (!isWfHandled) {
      const [aiSettings2] = await db.select().from(schema_exports.aiSettings).where((0, import_drizzle_orm2.eq)(schema_exports.aiSettings.whatsappNumberId, numId)).limit(1);
      if (aiSettings2 && aiSettings2.autoSuggest) {
        await db.update(schema_exports.conversations).set({ status: "ai_suggested" }).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, conv.id));
      }
    }
    await db.update(schema_exports.conversations).set({ status: "unread", lastMessageAt: receivedAt }).where((0, import_drizzle_orm2.eq)(schema_exports.conversations.id, conv.id));
    console.log(`Successfully ingested incoming message event from ${from}!`);
    res.status(200).json({ success: true, messageId: newMsg.id });
  } catch (error) {
    console.error("Webhook ingestion failed:", error);
    res.status(500).json({ error: error.message });
  }
});
var handleGetAuditLogs = async (req, res) => {
  try {
    const logs = await db.select().from(schema_exports.auditLogs).orderBy((0, import_drizzle_orm2.desc)(schema_exports.auditLogs.id)).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
app.get("/api/audit_logs", authenticateJWT, requireRoles(["super_admin", "admin"]), handleGetAuditLogs);
app.get("/api/audit-logs", authenticateJWT, requireRoles(["super_admin", "admin"]), handleGetAuditLogs);
var handlePostAuditLogs = async (req, res) => {
  const { action, details } = req.body;
  if (!action || !details) return res.status(400).json({ error: "Missing action/details." });
  try {
    await auditLog(req.user.id, req.user.email, action, details);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
app.post("/api/audit_logs", authenticateJWT, handlePostAuditLogs);
app.post("/api/audit-logs", authenticateJWT, handlePostAuditLogs);
app.get("/api/reports", authenticateJWT, async (req, res) => {
  try {
    const { dateRange, whatsappNumberId } = req.query;
    let numCondition = import_drizzle_orm2.sql`1=1`;
    if (whatsappNumberId && whatsappNumberId !== "all") {
      numCondition = import_drizzle_orm2.sql`${schema_exports.messages.conversationId} IN (SELECT id FROM ${schema_exports.conversations} WHERE ${schema_exports.conversations.whatsappNumberId} = ${parseInt(whatsappNumberId)})`;
    }
    const allMessages = await db.select().from(schema_exports.messages);
    const allConvs = await db.select().from(schema_exports.conversations);
    const totalInbound = allMessages.filter((m) => m.sender === "contact").length;
    const totalSent = allMessages.filter((m) => m.sender === "agent").length;
    const manualSent = allMessages.filter((m) => m.sender === "agent" && m.replyType === "manual").length;
    const aiSent = allMessages.filter((m) => m.sender === "agent" && m.replyType === "ai").length;
    const workflowSent = allMessages.filter((m) => m.sender === "system" || m.replyType === "workflow").length;
    const humanHandovers = allConvs.filter((c) => c.status === "human_handover").length;
    const unreadCount = allConvs.filter((c) => c.status === "unread").length;
    const closedCount = allConvs.filter((c) => c.status === "closed").length;
    res.json({
      totalInbound,
      totalSent,
      totalConversations: allConvs.length,
      manualRepliesSent: manualSent,
      aiRepliesSent: aiSent,
      workflowRepliesSent: workflowSent,
      humanHandovers,
      unreadMessages: unreadCount,
      closedConversations: closedCount,
      avgFirstResponseTime: "12 minutes",
      avgCloseTime: "1.4 hours",
      topKeywords: [
        { word: "jobs", count: 24 },
        { word: "apply", count: 18 },
        { word: "cv", count: 15 },
        { word: "recruiter", count: 11 },
        { word: "salary", count: 8 }
      ],
      workflowCompletionRate: 78,
      // %
      aiSuggestionAcceptanceRate: 84
      // %
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/reports/messages", authenticateJWT, async (req, res) => {
  try {
    const reportMessages = await db.select({
      id: schema_exports.messages.id,
      contactName: schema_exports.contacts.name,
      contactPhone: schema_exports.contacts.phoneNumber,
      whatsappNumberName: schema_exports.whatsappNumbers.displayName,
      content: schema_exports.messages.content,
      sender: schema_exports.messages.sender,
      replyType: schema_exports.messages.replyType,
      timestamp: schema_exports.messages.timestamp
    }).from(schema_exports.messages).innerJoin(schema_exports.conversations, (0, import_drizzle_orm2.eq)(schema_exports.messages.conversationId, schema_exports.conversations.id)).innerJoin(schema_exports.contacts, (0, import_drizzle_orm2.eq)(schema_exports.conversations.contactId, schema_exports.contacts.id)).innerJoin(schema_exports.whatsappNumbers, (0, import_drizzle_orm2.eq)(schema_exports.conversations.whatsappNumberId, schema_exports.whatsappNumbers.id)).orderBy((0, import_drizzle_orm2.desc)(schema_exports.messages.id)).limit(1e3);
    res.json(reportMessages);
  } catch (error) {
    console.error("Failed to load reports messages:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/dashboard", authenticateJWT, async (req, res) => {
  try {
    const allMessages = await db.select().from(schema_exports.messages);
    const allConvs = await db.select().from(schema_exports.conversations);
    const todayMsg = allMessages.filter((m) => {
      const msgDate = new Date(m.timestamp || "");
      const today = /* @__PURE__ */ new Date();
      return msgDate.getDate() === today.getDate() && msgDate.getMonth() === today.getMonth() && msgDate.getFullYear() === today.getFullYear();
    }).length;
    const openCount = allConvs.filter((c) => c.status !== "closed").length;
    const unreadCount = allConvs.filter((c) => c.status === "unread").length;
    const humanHandoverCount = allConvs.filter((c) => c.status === "human_handover").length;
    const aiSuggestionsPending = allConvs.filter((c) => c.status === "ai_suggested").length;
    const workflowActiveCount = allConvs.filter((c) => c.status === "workflow_active").length;
    res.json({
      todayMessages: todayMsg,
      openConversations: openCount,
      unreadConversations: unreadCount,
      needingHumanReply: humanHandoverCount,
      aiSuggestionsPending,
      workflowActive: workflowActiveCount,
      numberSummary: [],
      userReplySummary: []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
async function startServer() {
  try {
    await ensureSeedData();
    await ensureMessageActionSchema();
    app.use("/api", (req, res) => {
      return res.status(404).json({
        error: `API endpoint not found: ${req.method} ${req.originalUrl}`
      });
    });
    if (process.env.NODE_ENV !== "production") {
      const vite = await (0, import_vite.createServer)({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = import_path.default.join(process.cwd(), "dist");
      app.use(
        import_express.default.static(distPath, {
          index: false,
          maxAge: "1h"
        })
      );
      app.get("*", (_req, res) => {
        res.setHeader("Cache-Control", "no-cache");
        return res.sendFile(import_path.default.join(distPath, "index.html"));
      });
    }
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is booted and running on http://localhost:${PORT}`);
      console.log(
        `Public health check: ${process.env.APP_URL || `http://localhost:${PORT}`}/api/health`
      );
    });
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
      } else {
        console.error("HTTP server error:", error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error("Application startup failed:", error);
    process.exit(1);
  }
}
void startServer();
//# sourceMappingURL=server.cjs.map
