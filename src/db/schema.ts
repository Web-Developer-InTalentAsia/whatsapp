import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

// 1. Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull().default('user'), // 'super_admin' | 'admin' | 'user'
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  canEditWorkflows: boolean('can_edit_workflows').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. WhatsApp Numbers Settings
export const whatsappNumbers = pgTable('whatsapp_numbers', {
  id: serial('id').primaryKey(),
  displayName: text('display_name').notNull(),
  phoneNumber: text('phone_number').notNull().unique(),
  phoneNumberId: text('phone_number_id').notNull(),
  wabaId: text('waba_id').notNull(),
  appId: text('app_id').notNull(),
  appSecret: text('app_secret').notNull(),
  accessToken: text('access_token').notNull(),
  verifyToken: text('verify_token').notNull(),
  webhookStatus: text('webhook_status').notNull().default('Pending'), // 'Verified' | 'Pending'
  lastVerified: timestamp('last_verified'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. User - Number Assignment Bridge Table
export const userNumberAssignments = pgTable('user_number_assignments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  numberId: integer('number_id').references(() => whatsappNumbers.id, { onDelete: 'cascade' }).notNull(),
  isPrimaryOwner: boolean('is_primary_owner').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Contacts Table
export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  phoneNumber: text('phone_number').notNull(),
  name: text('name'),
  sourceNumberId: integer('source_number_id').references(() => whatsappNumbers.id, { onDelete: 'cascade' }).notNull(),
  firstMessageDate: timestamp('first_message_date').defaultNow(),
  lastMessageDate: timestamp('last_message_date').defaultNow(),
  assignedUserId: integer('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  tags: text('tags').notNull().default(''), // comma separated
  status: text('status').notNull().default('active'), // 'active' | 'closed' | 'follow-up'
  notes: text('notes').notNull().default(''),
  capturedAnswers: text('captured_answers').notNull().default('{}'), // JSON representation
  cvField: text('cv_field').notNull().default(''),
  linkedinField: text('linkedin_field').notNull().default(''),
  interestedJobRole: text('interested_job_role').notNull().default(''),
  expectedSalary: text('expected_salary').notNull().default(''),
  location: text('location').notNull().default(''),
  experience: text('experience').notNull().default(''),
  clientCandidateType: text('client_candidate_type').notNull().default('candidate'), // 'candidate' | 'client'
  companyName: text('company_name').notNull().default(''),
  companyWebsite: text('company_website').notNull().default(''),
  industry: text('industry').notNull().default(''),
  contactDesignation: text('contact_designation').notNull().default(''),
  hiringRequirements: text('hiring_requirements').notNull().default(''),
  vacancyCount: text('vacancy_count').notNull().default(''),
  hiringBudget: text('hiring_budget').notNull().default(''),
  companyLocation: text('company_location').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Conversations Table
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
  whatsappNumberId: integer('whatsapp_number_id').references(() => whatsappNumbers.id, { onDelete: 'cascade' }).notNull(),
  assignedUserId: integer('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('open'), // 'open' | 'human_handover' | 'ai_suggested' | 'workflow_active' | 'closed'
  isUnread: boolean('is_unread').notNull().default(false),
  lastMessageAt: timestamp('last_message_at').defaultNow(),
  lastInboundAt: timestamp('last_inbound_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Messages Table
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  sender: text('sender').notNull(), // 'contact' | 'agent' | 'system'
  senderName: text('sender_name').notNull(),
  content: text('content').notNull(),
  messageType: text('message_type').notNull().default('text'), // 'text' | 'document' | 'cv' | 'location'
  replyType: text('reply_type').notNull().default('none'), // 'manual' | 'ai' | 'workflow' | 'none'
  status: text('status').notNull().default('received'), // 'sent' | 'delivered' | 'read' | 'received' | 'failed'
  timestamp: timestamp('timestamp').defaultNow(),
  statusUpdatedAt: timestamp('status_updated_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  failedAt: timestamp('failed_at'),
  failureCode: text('failure_code'),
  failureTitle: text('failure_title'),
  failureDetails: text('failure_details'),
  retryCount: integer('retry_count').notNull().default(0),
  lastRetryAt: timestamp('last_retry_at'),
  retryOfMessageId: integer('retry_of_message_id'),
  templateName: text('template_name'),
  templateLanguage: text('template_language'),
  templateComponents: text('template_components'),
  agentId: integer('agent_id').references(() => users.id, { onDelete: 'set null' }),
  replyToMessageId: integer('reply_to_message_id'),
  forwardedFromMessageId: integer('forwarded_from_message_id'),
  deletedForEveryone: boolean('deleted_for_everyone').notNull().default(false),
  metaMessageId: text('meta_message_id'),
  replyContextMetaMessageId: text('reply_context_meta_message_id'),
  metaMediaId: text('meta_media_id'),
  mediaMimeType: text('media_mime_type'),
  mediaFilename: text('media_filename'),
  mediaCaption: text('media_caption'),
});

export const messageUserStates = pgTable('message_user_states', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  isStarred: boolean('is_starred').notNull().default(false),
  isPinned: boolean('is_pinned').notNull().default(false),
  deletedForMe: boolean('deleted_for_me').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 7. Workflows Table
export const workflows = pgTable('workflows', {
  id: serial('id').primaryKey(),
  whatsappNumberId: integer('whatsapp_number_id').references(() => whatsappNumbers.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  triggerKeyword: text('trigger_keyword').notNull(),
  welcomeMessage: text('welcome_message').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  steps: text('steps').notNull().default('[]'), // JSON string of steps
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. Workflow Sessions Table
export const workflowSessions = pgTable('workflow_sessions', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  workflowId: integer('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }).notNull(),
  currentStepId: text('current_step_id').notNull(),
  capturedData: text('captured_data').notNull().default('{}'), // JSON string of captured step variables
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 9. AI Settings Table
export const aiSettings = pgTable('ai_settings', {
  id: serial('id').primaryKey(),
  whatsappNumberId: integer('whatsapp_number_id').references(() => whatsappNumbers.id, { onDelete: 'cascade' }).notNull().unique(),
  aiProvider: text('ai_provider').notNull().default('gemini'),
  apiKey: text('api_key').notNull().default(''),
  modelName: text('model_name').notNull().default('gemini-2.5-flash'),
  defaultTone: text('default_tone').notNull().default('professional'), // 'professional' | 'casual' | 'friendly' | 'helpful'
  companyKnowledgeBase: text('company_knowledge_base').notNull().default(''),
  restrictedWords: text('restricted_words').notNull().default(''),
  autoSuggest: boolean('auto_suggest').notNull().default(true),
  autoReply: boolean('auto_reply').notNull().default(false),
  humanApprovalRequired: boolean('human_approval_required').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. AI Training Data Table
export const aiTrainingData = pgTable('ai_training_data', {
  id: serial('id').primaryKey(),
  whatsappNumberId: integer('whatsapp_number_id').references(() => whatsappNumbers.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // 'approved_reply' | 'rejected_reply' | 'faq' | 'rule'
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 11. Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  userEmail: text('user_email'),
  action: text('action').notNull(), // 'Login', 'Logout', 'Settings Changed', etc.
  details: text('details').notNull(),
  ipAddress: text('ip_address'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// 12. Quick Replies Table
export const quickReplies = pgTable('quick_replies', {
  id: serial('id').primaryKey(),
  whatsappNumberId: integer('whatsapp_number_id').references(() => whatsappNumbers.id, { onDelete: 'cascade' }).notNull(),
  shortcut: text('shortcut').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});


// 13. Synced Meta-approved Message Templates
export const metaMessageTemplates = pgTable('meta_message_templates', {
  id: serial('id').primaryKey(),
  whatsappNumberId: integer('whatsapp_number_id').references(() => whatsappNumbers.id, { onDelete: 'cascade' }).notNull(),
  metaTemplateId: text('meta_template_id'),
  name: text('name').notNull(),
  language: text('language').notNull(),
  category: text('category').notNull().default('UTILITY'),
  status: text('status').notNull().default('PENDING'),
  qualityScore: text('quality_score'),
  components: text('components').notNull().default('[]'),
  lastSyncedAt: timestamp('last_synced_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  assignments: many(userNumberAssignments),
  contactsAssigned: many(contacts),
  conversationsAssigned: many(conversations),
  messagesSent: many(messages),
  auditLogs: many(auditLogs),
}));

export const whatsappNumbersRelations = relations(whatsappNumbers, ({ many, one }) => ({
  assignments: many(userNumberAssignments),
  contacts: many(contacts),
  conversations: many(conversations),
  workflows: many(workflows),
  aiSettings: one(aiSettings, {
    fields: [whatsappNumbers.id],
    references: [aiSettings.whatsappNumberId],
  }),
  aiTrainingData: many(aiTrainingData),
  quickReplies: many(quickReplies),
  metaMessageTemplates: many(metaMessageTemplates),
}));

export const userNumberAssignmentsRelations = relations(userNumberAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userNumberAssignments.userId],
    references: [users.id],
  }),
  number: one(whatsappNumbers, {
    fields: [userNumberAssignments.numberId],
    references: [whatsappNumbers.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  sourceNumber: one(whatsappNumbers, {
    fields: [contacts.sourceNumberId],
    references: [whatsappNumbers.id],
  }),
  assignedUser: one(users, {
    fields: [contacts.assignedUserId],
    references: [users.id],
  }),
  conversations: many(conversations),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  whatsappNumber: one(whatsappNumbers, {
    fields: [conversations.whatsappNumberId],
    references: [whatsappNumbers.id],
  }),
  assignedUser: one(users, {
    fields: [conversations.assignedUserId],
    references: [users.id],
  }),
  messages: many(messages),
  workflowSessions: many(workflowSessions),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  agent: one(users, {
    fields: [messages.agentId],
    references: [users.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  whatsappNumber: one(whatsappNumbers, {
    fields: [workflows.whatsappNumberId],
    references: [whatsappNumbers.id],
  }),
  sessions: many(workflowSessions),
}));

export const workflowSessionsRelations = relations(workflowSessions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [workflowSessions.conversationId],
    references: [conversations.id],
  }),
  workflow: one(workflows, {
    fields: [workflowSessions.workflowId],
    references: [workflows.id],
  }),
}));

export const aiSettingsRelations = relations(aiSettings, ({ one }) => ({
  whatsappNumber: one(whatsappNumbers, {
    fields: [aiSettings.whatsappNumberId],
    references: [whatsappNumbers.id],
  }),
}));

export const aiTrainingDataRelations = relations(aiTrainingData, ({ one }) => ({
  whatsappNumber: one(whatsappNumbers, {
    fields: [aiTrainingData.whatsappNumberId],
    references: [whatsappNumbers.id],
  }),
}));

export const quickRepliesRelations = relations(quickReplies, ({ one }) => ({
  whatsappNumber: one(whatsappNumbers, {
    fields: [quickReplies.whatsappNumberId],
    references: [whatsappNumbers.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
