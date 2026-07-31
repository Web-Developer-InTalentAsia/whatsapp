export interface User {
  id: number;
  email: string;
  role: 'super_admin' | 'admin' | 'user';
  name: string;
  isActive: boolean;
  canEditWorkflows: boolean;
  createdAt?: string;
}

export interface WhatsAppNumber {
  id: number;
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  appId: string;
  appSecret?: string;
  accessToken?: string;
  verifyToken?: string;
  hasAppSecret?: boolean;
  hasAccessToken?: boolean;
  hasVerifyToken?: boolean;
  webhookStatus: string; // 'Verified' | 'Pending'
  lastVerified?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface Contact {
  id: number;
  phoneNumber: string;
  name: string | null;
  sourceNumberId: number;
  firstMessageDate?: string;
  lastMessageDate?: string;
  assignedUserId?: number | null;
  tags: string; // comma-separated
  status: 'active' | 'closed' | 'follow-up';
  notes: string;
  capturedAnswers: string; // JSON string
  cvField: string;
  linkedinField: string;
  interestedJobRole: string;
  expectedSalary: string;
  location: string;
  experience: string;
  clientCandidateType: 'candidate' | 'client';
  companyName: string;
  companyWebsite: string;
  industry: string;
  contactDesignation: string;
  hiringRequirements: string;
  vacancyCount: string;
  hiringBudget: string;
  companyLocation: string;
}

export interface Conversation {
  id: number;
  contactId: number;
  whatsappNumberId: number;
  assignedUserId?: number | null;
  status: 'open' | 'human_handover' | 'ai_suggested' | 'workflow_active' | 'closed';
  isUnread: boolean;
  lastMessageAt: string;
  createdAt?: string;
  contact?: Contact;
}

export interface Message {
  id: number;
  conversationId: number;
  sender: 'contact' | 'agent' | 'system';
  senderName: string;
  content: string;
  messageType: 'text' | 'document' | 'cv' | 'location' | 'image' | 'video' | 'audio' | 'sticker';
  replyType: 'manual' | 'ai' | 'workflow' | 'handover' | 'none';
  status: 'sent' | 'delivered' | 'read' | 'received' | 'failed';
  timestamp: string;
  statusUpdatedAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  failureCode?: string | null;
  failureTitle?: string | null;
  failureDetails?: string | null;
  retryCount?: number;
  lastRetryAt?: string | null;
  retryOfMessageId?: number | null;
  agentId?: number | null;
  replyToMessageId?: number | null;
  forwardedFromMessageId?: number | null;
  deletedForEveryone?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
  deletedForMe?: boolean;
  metaMessageId?: string | null;
  replyContextMetaMessageId?: string | null;
  hasUnmatchedReplyContext?: boolean;
  metaMediaId?: string | null;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  mediaCaption?: string | null;
  repliedMessage?: {
    id: number;
    senderName: string;
    content: string;
    deletedForEveryone?: boolean;
  } | null;
}

export interface WorkflowStep {
  id: string;
  type: 'question' | 'menu' | 'capture_text' | 'end_workflow' | 'handover';
  questionText: string;
  variableName?: string; // name of contact field to save answer (e.g. cvField, interestedJobRole, etc.)
  options?: {
    key: string;
    text: string;
    nextStepId: string;
  }[];
  nextStepId?: string;
}

export interface Workflow {
  id: number;
  whatsappNumberId: number;
  name: string;
  triggerKeyword: string;
  welcomeMessage: string;
  isActive: boolean;
  steps: string; // JSON string of WorkflowStep[]
  createdAt?: string;
}

export interface AISettings {
  id: number;
  whatsappNumberId: number;
  aiProvider: string;
  apiConfigured?: boolean;
  modelName: string;
  defaultTone: 'professional' | 'casual' | 'friendly' | 'helpful';
  companyKnowledgeBase: string;
  restrictedWords: string;
  autoSuggest: boolean;
  autoReply: boolean;
  humanApprovalRequired: boolean;
}

export interface AITrainingData {
  id: number;
  whatsappNumberId: number;
  type: 'approved_reply' | 'rejected_reply' | 'faq' | 'rule';
  question: string;
  answer: string;
  createdAt?: string;
}

export interface AuditLog {
  id: number;
  userId?: number | null;
  userEmail?: string | null;
  action: string;
  details: string;
  ipAddress?: string | null;
  timestamp: string;
}

export interface QuickReply {
  id: number;
  whatsappNumberId: number;
  shortcut: string;
  message: string;
  createdAt?: string;
}
