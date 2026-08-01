import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { 
  Search, MessageCircle, AlertCircle, Sparkles, Send, Clock, User, Check,
  Tags, Info, CheckCircle2, ChevronRight, CornerDownRight, ThumbsUp, ThumbsDown,
  RefreshCw, Clipboard, Paperclip, CheckSquare, Plus, Calendar, Zap,
  MoreVertical, Reply, Forward, Pin, Star, X
  , Mic, Square, FileText, Download
} from "lucide-react";
import { Contact, Conversation, Message, MetaMessageTemplate } from "../types.ts";

interface InboxProps {
  token: string;
  currentUser: any;
  initialConversationId?: number | null;
  onInitialConversationHandled?: () => void;
}

function MessageMedia({ message, token }: { message: Message; token: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!message.metaMediaId) return;
    let objectUrl = "";
    let stopped = false;
    void fetch(`/api/messages/${message.id}/media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(response => {
        if (!response.ok) throw new Error("Media download failed.");
        return response.blob();
      })
      .then(blob => {
        if (stopped) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(error => console.error(error));
    return () => {
      stopped = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.id, message.metaMediaId, token]);

  if (!url) {
    return <div className="mb-2 h-16 min-w-48 rounded-lg bg-black/20 animate-pulse flex items-center justify-center text-xs opacity-60">Loading attachment…</div>;
  }
  if (message.messageType === "image" || message.messageType === "sticker") {
    return <img src={url} alt={message.mediaCaption || "WhatsApp image"} className={`mb-2 rounded-lg max-h-72 object-contain ${message.messageType === "sticker" ? "max-w-40 bg-transparent" : "max-w-full"}`} />;
  }
  if (message.messageType === "video") {
    return <video src={url} controls preload="metadata" className="mb-2 rounded-lg max-h-72 max-w-full" />;
  }
  if (message.messageType === "audio") {
    return <audio src={url} controls preload="metadata" className="mb-2 max-w-full h-10" />;
  }
  return (
    <a href={url} download={message.mediaFilename || "attachment"} className="mb-2 flex items-center gap-3 rounded-lg bg-black/20 p-3 hover:bg-black/30">
      <FileText className="h-6 w-6 shrink-0" />
      <span className="text-xs truncate flex-1">{message.mediaFilename || "Document"}</span>
      <Download className="h-4 w-4 shrink-0" />
    </a>
  );
}

function getDeliveryStatusLabel(message: Message) {
  if (message.status === "read") return "Read";
  if (message.status === "delivered") return "Delivered";
  if (message.status === "sent") return "Sent";
  if (message.status === "failed") return "Failed";
  return message.status;
}

function getDeliveryStatusTitle(message: Message) {
  const label = getDeliveryStatusLabel(message);
  const timestamp =
    message.readAt ||
    message.deliveredAt ||
    message.failedAt ||
    message.statusUpdatedAt ||
    message.timestamp;
  const detail = message.failureDetails ? `: ${message.failureDetails}` : "";
  return `${label}${timestamp ? ` at ${new Date(timestamp).toLocaleString()}` : ""}${detail}`;
}

function getServiceWindowView(conversation: Conversation | null, nowMs: number) {
  const expiresAt = conversation?.serviceWindowExpiresAt
    ? new Date(conversation.serviceWindowExpiresAt)
    : conversation?.lastInboundAt
      ? new Date(new Date(conversation.lastInboundAt).getTime() + 24 * 60 * 60 * 1000)
      : null;

  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return {
      isOpen: false,
      expiresAt: null as Date | null,
      remainingSeconds: 0,
    };
  }

  const remainingSeconds = Math.max(0, Math.ceil((expiresAt.getTime() - nowMs) / 1000));
  return {
    isOpen: remainingSeconds > 0,
    expiresAt,
    remainingSeconds,
  };
}

function formatServiceWindowRemaining(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m remaining`;
  return "less than 1 minute remaining";
}

export default function Inbox({ token, currentUser, initialConversationId, onInitialConversationHandled }: InboxProps) {
  // States
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [assignedToMe, setAssignedToMe] = useState(false);
  
  const [replyText, setReplyText] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<number | null>(null);
  const [resumingAutomation, setResumingAutomation] = useState(false);
  const [serviceWindowClock, setServiceWindowClock] = useState(() => Date.now());
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [attachment, setAttachment] = useState<{ filename: string; mimeType: string; data: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  // Quick Replies State
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [showQuickReplyMenu, setShowQuickReplyMenu] = useState(false);
  const [showQuickRepliesButtonMenu, setShowQuickRepliesButtonMenu] = useState(false);
  const [filteredReplies, setFilteredReplies] = useState<any[]>([]);
  const [activeReplyIndex, setActiveReplyIndex] = useState(0);

  // Synced Meta-approved templates
  const [metaTemplates, setMetaTemplates] = useState<MetaMessageTemplate[]>([]);
  const [loadingMetaTemplates, setLoadingMetaTemplates] = useState(false);
  const [syncingMetaTemplates, setSyncingMetaTemplates] = useState(false);
  const [showMetaTemplatePanel, setShowMetaTemplatePanel] = useState(false);
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState<MetaMessageTemplate | null>(null);
  const [metaTemplateValues, setMetaTemplateValues] = useState<Record<string, string>>({});
  const [metaTemplateSearch, setMetaTemplateSearch] = useState("");
  const [metaTemplateStatusFilter, setMetaTemplateStatusFilter] = useState("active");
  const [metaTemplateSyncNotice, setMetaTemplateSyncNotice] = useState("");
  const [sendingMetaTemplate, setSendingMetaTemplate] = useState(false);

  // AI suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionSourceSummary, setSuggestionSourceSummary] = useState("");

  // Users for assignment selection
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const serviceWindow = getServiceWindowView(selectedConversation, serviceWindowClock);
  const freeFormMessagingAllowed = serviceWindow.isOpen;

  useEffect(() => {
    const intervalId = window.setInterval(() => setServiceWindowClock(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Fetch conversations list
  const fetchConversations = async (selectedIdToKeep?: number) => {
    try {
      const qs = new URLSearchParams({
        status: filter,
        assignedToMe: assignedToMe ? "true" : "false",
        search: search
      });
      const response = await fetch(`/api/conversations?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        
        // Refresh selected conversation reference to get updated status
        if (selectedConversation) {
          const currentId = selectedIdToKeep || selectedConversation.id;
          const fresh = data.find((c: any) => c.id === currentId);
          if (fresh) {
            setSelectedConversation(fresh);
          }
        }
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch users list for assigning
  const fetchAllUsers = async () => {
    try {
      // Admin/Super Admin can fetch users
      if (["super_admin", "admin"].includes(currentUser.role)) {
        const response = await fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setAllUsers(data);
        }
      } else {
        // Just self
        setAllUsers([currentUser]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchAllUsers();
  }, [filter, assignedToMe, search, token]);

  // Keep the thread rail in sync with inbound webhook messages. Read/unread is
  // now independent from workflow, AI, handover, and closed business states.
  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchConversations();
      }
    }, 5000);

    return () => window.clearInterval(refreshInterval);
  }, [filter, assignedToMe, search, token, selectedConversation?.id]);

  // Opening a conversation marks only its read flag as cleared. Its workflow,
  // handover, AI, or closed state remains unchanged. This also handles a new
  // inbound message that arrives while the recruiter already has the thread open.
  useEffect(() => {
    if (!selectedConversation?.isUnread || document.visibilityState !== "visible") {
      return;
    }

    const conversationId = selectedConversation.id;
    let stopped = false;

    void fetch(`/api/conversations/${conversationId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isUnread: false }),
    })
      .then(response => {
        if (!response.ok || stopped) return;

        setSelectedConversation(previous =>
          previous?.id === conversationId
            ? { ...previous, isUnread: false }
            : previous,
        );
        setConversations(previous =>
          filter === "unread"
            ? previous.filter(conversation => conversation.id !== conversationId)
            : previous.map(conversation =>
                conversation.id === conversationId
                  ? { ...conversation, isUnread: false }
                  : conversation,
              ),
        );
      })
      .catch(error => console.error("Unable to mark conversation as read:", error));

    return () => {
      stopped = true;
    };
  }, [selectedConversation?.id, selectedConversation?.isUnread, token, filter]);

  // Keep the open thread synchronized as webhook messages arrive. Previously
  // only the conversation rail refreshed, so a quoted inbound reply could look
  // like a detached message until the thread was reopened.
  useEffect(() => {
    if (!selectedConversation) return;

    let stopped = false;
    const refreshOpenThread = async () => {
      try {
        const response = await fetch(
          `/api/conversations/${selectedConversation.id}/messages`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok || stopped) return;

        const updatedMessages: Message[] = await response.json();
        if (stopped) return;
        setMessages(previous => {
          const previousSignature = previous.map(message =>
            `${message.id}:${message.isStarred}:${message.isPinned}:${message.replyToMessageId || ""}:${message.status}:${message.statusUpdatedAt || ""}:${message.retryCount || 0}:${message.failureCode || ""}`
          ).join("|");
          const updatedSignature = updatedMessages.map(message =>
            `${message.id}:${message.isStarred}:${message.isPinned}:${message.replyToMessageId || ""}:${message.status}:${message.statusUpdatedAt || ""}:${message.retryCount || 0}:${message.failureCode || ""}`
          ).join("|");
          return previousSignature === updatedSignature ? previous : updatedMessages;
        });
      } catch (error) {
        console.error("Unable to refresh the open conversation:", error);
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshOpenThread();
      }
    }, 3000);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [selectedConversation?.id, token]);

  // Handle selected conversation change
  const handleSelectConversation = async (conv: Conversation) => {
    setLoadingChat(true);
    setSelectedConversation(conv);
    setMessages([]);
    setSuggestions([]);
    setSuggestionError("");
    setSuggestionSourceSummary("");
    setContact(null);
    setReplyText("");
    setShowMetaTemplatePanel(false);
    setSelectedMetaTemplate(null);
    setMetaTemplateValues({});
    setMetaTemplateSearch("");

    try {
      // 1. Fetch details
      const response = await fetch(`/api/conversations/${conv.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContact(data.contact);
        if (data.conversation) {
          setSelectedConversation((previous) => (
            previous?.id === data.conversation.id
              ? { ...previous, ...data.conversation }
              : data.conversation
          ));
          setServiceWindowClock(Date.now());
        }
      }

      // 2. Fetch messages
      const mRes = await fetch(`/api/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (mRes.ok) {
        const mData = await mRes.json();
        setMessages(mData);

      }

      // 3. Read state is cleared by the selected-conversation effect without
      // changing the conversation's workflow/handover status.

      // 4. Fetch Quick Replies for this WhatsApp line
      const qrRes = await fetch(`/api/whatsapp_numbers/${conv.whatsappNumberId}/quick-replies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        setQuickReplies(qrData);
        setFilteredReplies(qrData);
      }


      // 5. Fetch Meta-approved message templates synced for this line
      setLoadingMetaTemplates(true);
      const templateRes = await fetch(`/api/whatsapp_numbers/${conv.whatsappNumberId}/message-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (templateRes.ok) {
        const templateData = await templateRes.json();
        setMetaTemplates(Array.isArray(templateData) ? templateData : []);
      } else {
        setMetaTemplates([]);
      }
      setMetaTemplateSyncNotice("");
      setLoadingMetaTemplates(false);
    } catch (err) {
      console.error("Error loading chat details:", err);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (!initialConversationId) return;

    let stopped = false;
    const openRequestedConversation = async () => {
      try {
        setFilter("all");
        setAssignedToMe(false);
        setSearch("");
        const response = await fetch(`/api/conversations/${initialConversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok || stopped) return;
        const data = await response.json();
        if (!data?.conversation || stopped) return;
        await handleSelectConversation(data.conversation as Conversation);
      } catch (error) {
        console.error("Could not open notification conversation:", error);
      } finally {
        if (!stopped) onInitialConversationHandled?.();
      }
    };

    void openRequestedConversation();
    return () => {
      stopped = true;
    };
  }, [initialConversationId, token]);

  const handleSyncMetaTemplates = async () => {
    if (!selectedConversation || syncingMetaTemplates) return;
    setSyncingMetaTemplates(true);
    setMetaTemplateSyncNotice("");
    try {
      const response = await fetch(
        `/api/whatsapp_numbers/${selectedConversation.whatsappNumberId}/message-templates/sync`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMetaTemplateSyncNotice(`${data.error || "Could not sync Meta templates."} Existing cached templates were preserved.`);
        return;
      }
      setMetaTemplates(Array.isArray(data.templates) ? data.templates : []);
      setSelectedMetaTemplate(null);
      setMetaTemplateValues({});
      setMetaTemplateSyncNotice(
        `Sync complete: ${data.count || 0} active, ${data.approvedCount || 0} approved, ${data.pendingCount || 0} pending, ${data.rejectedCount || 0} rejected, ${data.archivedCount || 0} archived. ${data.duplicateCount || 0} duplicate Meta records ignored.`,
      );
    } catch (error) {
      console.error("Template sync error:", error);
      setMetaTemplateSyncNotice("Could not reach Meta template sync service. Existing cached templates were preserved.");
    } finally {
      setSyncingMetaTemplates(false);
    }
  };

  const handleChooseMetaTemplate = (template: MetaMessageTemplate) => {
    if (template.canSend === false || template.status !== "APPROVED" || template.supported === false || template.isArchived) return;
    setSelectedMetaTemplate(template);
    const emptyValues: Record<string, string> = {};
    for (const definition of template.parameterDefinitions || []) {
      emptyValues[definition.key] = "";
    }
    setMetaTemplateValues(emptyValues);
  };

  const handleSendMetaTemplate = async () => {
    if (!selectedConversation || !selectedMetaTemplate || sendingMetaTemplate) return;
    if (selectedMetaTemplate.canSend === false) {
      alert(selectedMetaTemplate.sendBlockReason || "Sync this template from Meta before sending.");
      return;
    }
    const missing = (selectedMetaTemplate.parameterDefinitions || []).find(definition =>
      definition.required && !String(metaTemplateValues[definition.key] || "").trim()
    );
    if (missing) {
      alert(`Please enter ${missing.label}.`);
      return;
    }

    setSendingMetaTemplate(true);
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/send-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          templateId: selectedMetaTemplate.id,
          parameterValues: metaTemplateValues,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.message) setMessages(previous => [...previous, data.message]);
        alert(data.error || "Could not send the approved Meta template.");
        return;
      }

      setMessages(previous => [...previous, data]);
      setShowMetaTemplatePanel(false);
      setSelectedMetaTemplate(null);
      setMetaTemplateValues({});
      setMetaTemplateSearch("");
      await fetchConversations(selectedConversation.id);
    } catch (error) {
      console.error("Template send error:", error);
      alert("Could not send the approved Meta template.");
    } finally {
      setSendingMetaTemplate(false);
    }
  };

  // Fetch grounded AI suggestions. The backend deliberately returns an
  // actionable error instead of fabricated demo replies when Gemini or the
  // approved knowledge base is not ready.
  const fetchAISuggestions = async () => {
    if (!selectedConversation) return;
    setLoadingSuggestions(true);
    setSuggestions([]);
    setSuggestionError("");
    setSuggestionSourceSummary("");

    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/ai-suggestions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSuggestionError(data.error || "Verified AI suggestions could not be generated.");
        return;
      }

      const generatedSuggestions = Array.isArray(data)
        ? data
        : Array.isArray(data.suggestions)
          ? data.suggestions
          : [];

      if (generatedSuggestions.length === 0) {
        setSuggestionError("Gemini returned no verified suggestions. Please reply manually or regenerate.");
        return;
      }

      setSuggestions(generatedSuggestions);

      if (data.sources) {
        const sourceParts = [
          data.sources.knowledgeBase ? "Knowledge Base" : "",
          data.sources.faqs ? `${data.sources.faqs} FAQ${data.sources.faqs === 1 ? "" : "s"}` : "",
          data.sources.rules ? `${data.sources.rules} rule${data.sources.rules === 1 ? "" : "s"}` : "",
          data.sources.approvedReplies ? `${data.sources.approvedReplies} approved repl${data.sources.approvedReplies === 1 ? "y" : "ies"}` : "",
        ].filter(Boolean);
        setSuggestionSourceSummary(sourceParts.join(" • "));
      }
    } catch (err) {
      console.error(err);
      setSuggestionError("The AI service could not be reached. No fallback suggestion was shown.");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Open every thread at its newest message. Setting the scroll container
  // directly is more reliable than scrollIntoView while the flex layout and
  // media previews are still settling.
  useLayoutEffect(() => {
    if (loadingChat || messages.length === 0) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const scrollToLatest = () => {
      container.scrollTop = container.scrollHeight;
    };
    scrollToLatest();
    const frameId = window.requestAnimationFrame(scrollToLatest);
    const timeoutId = window.setTimeout(scrollToLatest, 150);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [selectedConversation?.id, loadingChat, messages.length]);

  // Quick Replies functions
  const handleTextareaChange = (val: string) => {
    setReplyText(val);

    // Parse the slash command trigger (ends with / or /shortcut)
    const lastWord = val.split(/[\s\n]+/).pop() || "";
    if (lastWord.startsWith("/")) {
      const searchStr = lastWord.slice(1).toLowerCase();
      const matches = quickReplies.filter(qr => 
        qr.shortcut.toLowerCase().includes(searchStr)
      );
      setFilteredReplies(matches);
      setShowQuickReplyMenu(matches.length > 0);
      setActiveReplyIndex(0);
    } else {
      setShowQuickReplyMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showQuickReplyMenu && filteredReplies.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveReplyIndex(prev => (prev + 1) % filteredReplies.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveReplyIndex(prev => (prev - 1 + filteredReplies.length) % filteredReplies.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertQuickReply(filteredReplies[activeReplyIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowQuickReplyMenu(false);
      }
    }
  };

  const insertQuickReply = (qr: any) => {
    // Replace the last typed word starting with "/" or simply set/append if empty
    const lastWordRegex = /\/\S*$/;
    if (lastWordRegex.test(replyText)) {
      setReplyText(replyText.replace(lastWordRegex, qr.message));
    } else {
      setReplyText(prev => prev ? prev + "\n" + qr.message : qr.message);
    }
    setShowQuickReplyMenu(false);
    setShowQuickRepliesButtonMenu(false);
  };

  const selectAttachment = (file?: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("Attachments must be 20 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      data: String(reader.result || ""),
    });
    reader.readAsDataURL(file);
  };

  const toggleVoiceRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const reader = new FileReader();
        reader.onload = () => setAttachment({
          filename: `voice-message-${Date.now()}.webm`,
          mimeType: blob.type || "audio/webm",
          data: String(reader.result || ""),
        });
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone error:", error);
      alert("Microphone access is required to record a voice message.");
    }
  };

  // Send Message
  const handleSendMessage = async (text: string, replyType: 'manual' | 'ai' | 'workflow' = 'manual') => {
    if (!selectedConversation || (!text.trim() && !attachment) || !contact) return;
    if (!freeFormMessagingAllowed) {
      alert(
        "The WhatsApp 24-hour customer service window is closed. Free-form replies are blocked. Use an approved Meta template or wait for the contact to send a new message.",
      );
      return;
    }
    setSendingReply(true);

    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          whatsappNumberId: selectedConversation.whatsappNumberId,
          recipientPhone: contact.phoneNumber,
          messageText: text,
          replyType,
          replyToMessageId: replyingTo?.id || null,
          media: attachment,
        })
      });

      let data: any = {};
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        alert(text || "Failed to send message.");
        return;
      }

      if (!response.ok) {
        if (data.code === "WHATSAPP_SERVICE_WINDOW_CLOSED") {
          setSelectedConversation(previous => previous ? {
            ...previous,
            serviceWindowOpen: false,
            serviceWindowExpiresAt: data.serviceWindowExpiresAt || previous.serviceWindowExpiresAt,
            lastInboundAt: data.lastInboundAt || previous.lastInboundAt,
            serviceWindowRemainingSeconds: 0,
          } : previous);
          setServiceWindowClock(Date.now());
        }
        alert(data.error || "Failed to send message.");
        return;
      }

      // Add to logs locally, including the quoted preview without waiting for
      // the thread to be fetched again.
      setMessages(prev => [...prev, {
        ...data,
        repliedMessage: replyingTo ? {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          content: replyingTo.content,
          deletedForEveryone: replyingTo.deletedForEveryone,
        } : null,
      }]);
      setReplyText("");
      setAttachment(null);
      setReplyingTo(null);
      setSuggestions([]); // Clear suggestions upon reply
      setSuggestionError("");
      setSuggestionSourceSummary("");

      // Reload conversation list
      fetchConversations(selectedConversation.id);
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleRetryMessage = async (message: Message) => {
    if (message.status !== "failed" || retryingMessageId !== null) return;
    if (!freeFormMessagingAllowed && message.replyType !== "template") {
      alert(
        "This free-form retry is blocked because the WhatsApp 24-hour customer service window is closed. Approved template retries are still allowed.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Retry this failed WhatsApp message? A new message record will be created if Meta accepts the retry.",
    );
    if (!confirmed) return;

    setRetryingMessageId(message.id);
    try {
      const response = await fetch(`/api/messages/${message.id}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.code === "WHATSAPP_SERVICE_WINDOW_CLOSED") {
          setSelectedConversation(previous => previous ? {
            ...previous,
            serviceWindowOpen: false,
            serviceWindowExpiresAt: data.serviceWindowExpiresAt || previous.serviceWindowExpiresAt,
            lastInboundAt: data.lastInboundAt || previous.lastInboundAt,
            serviceWindowRemainingSeconds: 0,
          } : previous);
          setServiceWindowClock(Date.now());
        }
        alert(data.error || "Could not retry the message.");
        setMessages(previous => previous.map(item =>
          item.id === message.id
            ? {
                ...item,
                retryCount: data.retryCount ?? item.retryCount,
                failureDetails: data.error || item.failureDetails,
              }
            : item,
        ));
        return;
      }

      setMessages(previous => {
        const updatedSource = previous.map(item =>
          item.id === data.sourceMessageId
            ? { ...item, retryCount: data.sourceRetryCount, lastRetryAt: new Date().toISOString() }
            : item,
        );
        return data.message ? [...updatedSource, data.message] : updatedSource;
      });

      if (selectedConversation) {
        await fetchConversations(selectedConversation.id);
      }
    } catch (error) {
      console.error("Retry error:", error);
      alert("Could not retry the message.");
    } finally {
      setRetryingMessageId(null);
    }
  };

  const updateMessageState = async (
    message: Message,
    updates: { isStarred?: boolean; isPinned?: boolean },
  ) => {
    const response = await fetch(`/api/messages/${message.id}/state`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || "Could not update the message.");
      return;
    }
    setMessages(previous => previous.map(item =>
      item.id === message.id ? { ...item, ...updates } : item
    ));
    setOpenActionMenuId(null);
  };

  const forwardMessage = async (target: Conversation) => {
    if (!forwardingMessage) return;
    try {
      const detailsResponse = await fetch(`/api/conversations/${target.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const details = await detailsResponse.json();
      if (!detailsResponse.ok || !details.contact) {
        alert(details.error || "Could not load the target conversation.");
        return;
      }

      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: target.id,
          whatsappNumberId: target.whatsappNumberId,
          recipientPhone: details.contact.phoneNumber,
          messageText: forwardingMessage.content,
          replyType: "manual",
          forwardedFromMessageId: forwardingMessage.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || "Could not forward the message.");
        return;
      }
      setForwardingMessage(null);
      setOpenActionMenuId(null);
      alert("Message forwarded successfully.");
    } catch (error) {
      console.error("Forward error:", error);
      alert("Could not forward the message.");
    }
  };

  // Save Contact Notes
  const handleSaveContactProfile = async (updates: Partial<Contact>) => {
    if (!contact) return;
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        const data = await response.json();
        setContact(data);
        alert("Contact profile updated!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResumeAutomation = async () => {
    if (!selectedConversation || selectedConversation.status !== "human_handover") return;
    const confirmed = window.confirm(
      "Resume automation for this conversation? Future candidate messages may be handled by AI or a matching workflow."
    );
    if (!confirmed) return;

    setResumingAutomation(true);
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: "open", isUnread: false })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || "Could not resume automation.");
        return;
      }
      setSelectedConversation(previous => previous
        ? { ...previous, status: "open", isUnread: false }
        : previous
      );
      await fetchConversations(selectedConversation.id);
    } catch (err) {
      console.error(err);
      alert("Could not resume automation.");
    } finally {
      setResumingAutomation(false);
    }
  };

  // Quick Action Toggles on Conversation
  const handleUpdateConvStatus = async (status: string) => {
    if (!selectedConversation) return;
    if (selectedConversation.status === "human_handover" && status === "open") {
      await handleResumeAutomation();
      return;
    }
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        fetchConversations(selectedConversation.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignUser = async (userIdStr: string) => {
    if (!selectedConversation) return;
    const assignedUserId = userIdStr ? parseInt(userIdStr) : null;
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ assignedUserId })
      });
      if (response.ok) {
        fetchConversations(selectedConversation.id);
        alert("Conversation assigned successfully!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // AI Training Interaction
  const handleTrainAI = async (text: string, isApproved: boolean) => {
    if (!selectedConversation) return;
    try {
      const type = isApproved ? "approved_reply" : "rejected_reply";
      const response = await fetch("/api/ai-suggestions/train", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          whatsappNumberId: selectedConversation.whatsappNumberId,
          type,
          question: messages[messages.length - 1]?.content || "Inbound message",
          answer: text
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || "Unable to save AI feedback.");
        return;
      }
      alert(
        isApproved
          ? "Approved. This reply can be used as a trusted example for future suggestions."
          : "Rejected. This reply is stored as feedback and excluded from trusted knowledge.",
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="inbox-shell h-[calc(100vh-72px)] flex bg-[#06090c] overflow-hidden font-sans text-zinc-100">
      {forwardingMessage && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0c0c0e] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-zinc-100">Forward message</h3>
                <p className="text-xs text-zinc-500 mt-1 truncate max-w-sm">
                  {forwardingMessage.content}
                </p>
              </div>
              <button onClick={() => setForwardingMessage(null)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {conversations.filter(item => item.id !== selectedConversation?.id).map(conversation => (
                <button
                  key={conversation.id}
                  onClick={() => void forwardMessage(conversation)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-900 text-left transition"
                >
                  <div className="h-9 w-9 rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold">
                    {(conversation as any).contactName?.charAt(0) || <User className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-200">
                      {(conversation as any).contactName || (conversation as any).contactPhone || "WhatsApp contact"}
                    </div>
                    <div className="text-[10px] text-zinc-500">{(conversation as any).whatsappNumberName}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* 1. Left Panel: Conversation Threads */}
      <div className="w-80 md:w-96 flex flex-col border-r border-zinc-900 bg-[#0c0c0e]">
        
        {/* Search & Header */}
        <div className="p-4 border-b border-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-400" />
              Conversations
            </h2>
            <button
              onClick={() => fetchConversations()}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-emerald-400 transition"
              title="Refresh inbox"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute inset-y-0 left-3 h-4 w-4 my-auto text-zinc-500" />
            <input
              type="text"
              placeholder="Search candidate, number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900/50 pl-9 pr-4 py-2 border border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-100 placeholder-zinc-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={(e) => setAssignedToMe(e.target.checked)}
                className="rounded border-zinc-800 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
              />
              Assigned to me
            </label>
          </div>
        </div>

        {/* Filters Carousel */}
        <div className="px-4 py-2.5 bg-[#0c0c0e] border-b border-zinc-900 flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          {[
            { id: "all", label: "Active" },
            { id: "unread", label: "Unread" },
            { id: "human_handover", label: "Recruiter" },
            { id: "ai_suggested", label: "AI Suggestions" },
            { id: "workflow_active", label: "Workflow" },
            { id: "closed", label: "Closed" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition cursor-pointer ${
                filter === item.id 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" 
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
          {loadingList ? (
            <div className="p-8 text-center text-zinc-500 text-sm animate-pulse">Loading inbox threads...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">No conversations match the filters.</div>
          ) : (
            conversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id;
              const formattedTime = new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              // Status Styling
              let statusLabel = "";
              let statusClass = "";
              if (conv.status === "human_handover") {
                statusLabel = "Live Recruiter";
                statusClass = "bg-rose-950/40 text-rose-400 border border-rose-900/40";
              } else if (conv.status === "ai_suggested") {
                statusLabel = "AI Suggestion";
                statusClass = "bg-teal-950/40 text-teal-400 border border-teal-900/40";
              } else if (conv.status === "workflow_active") {
                statusLabel = "Workflow Active";
                statusClass = "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40";
              }

              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`relative p-4 transition cursor-pointer flex flex-col gap-1.5 ${
                    conv.isUnread
                      ? "bg-emerald-950/25 border-l-4 border-emerald-400 hover:bg-emerald-950/40"
                      : "hover:bg-zinc-900/40 border-l-4 border-transparent"
                  } ${
                    isSelected ? "ring-1 ring-inset ring-emerald-500/50" : ""
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 min-w-0">
                      {conv.isUnread && (
                        <span
                          className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] shrink-0"
                          aria-label="Unread conversation"
                        />
                      )}
                      <h4 className={`text-sm truncate max-w-[150px] ${
                        conv.isUnread ? "font-bold text-white" : "font-semibold text-zinc-200"
                      }`}>
                        {conv.contactName || conv.contactPhone}
                      </h4>
                    </div>
                    <span className={`text-xs shrink-0 ${
                      conv.isUnread ? "font-semibold text-emerald-300" : "text-zinc-500"
                    }`}>{formattedTime}</span>
                  </div>

                  <p className="text-xs text-zinc-500 truncate font-mono">
                    {conv.contactPhone}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[10px] text-zinc-500 font-medium truncate max-w-[120px]">
                      via {conv.whatsappNumberName}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {conv.isUnread && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-950/40 text-amber-400 border-amber-900/40">
                          Unread
                        </span>
                      )}
                      {statusLabel && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusClass}`}>
                          {statusLabel}
                        </span>
                      )}
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded-full font-medium capitalize">
                        {conv.contactType}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Main Panel: Full Chat history & Reply area */}
      <div className="flex-1 flex flex-col bg-[#0c0c0e]">
        {selectedConversation ? (
          <>
            {/* Active chat header */}
            <div className="px-6 py-3.5 border-b border-zinc-900 flex items-center justify-between bg-[#0c0c0e] shadow-lg z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-zinc-100 text-base">
                    {selectedConversation.contactName || selectedConversation.contactPhone}
                  </h3>
                  <span className="text-xs bg-zinc-900 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded font-mono">
                    {selectedConversation.contactPhone}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Receiving Line: {selectedConversation.whatsappNumberName}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Assignment Selector */}
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-zinc-500" />
                  <select
                    value={selectedConversation.assignedUserId || ""}
                    onChange={(e) => handleAssignUser(e.target.value)}
                    className="border border-zinc-800 rounded-lg text-xs py-1 px-1.5 bg-zinc-900 focus:ring-1 focus:ring-emerald-500 text-zinc-300"
                  >
                    <option value="">Unassigned</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status Switcher */}
                <select
                  value={selectedConversation.status}
                  onChange={(e) => handleUpdateConvStatus(e.target.value)}
                  disabled={resumingAutomation}
                  className="border border-zinc-800 rounded-lg text-xs py-1 px-1.5 bg-zinc-900 focus:ring-1 focus:ring-emerald-500 text-zinc-300 font-semibold disabled:opacity-60"
                >
                  <option value="open">Open</option>
                  <option value="human_handover">Recruiter Handover</option>
                  <option value="workflow_active">Workflow Active</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {selectedConversation.status === "human_handover" && (
              <div className="mx-6 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-300">Recruiter takeover is active</p>
                    <p className="text-[11px] text-amber-100/70 mt-0.5">
                      AI and workflows stay paused after manual replies. Resume automation only when the recruiter has finished this conversation.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResumeAutomation}
                  disabled={resumingAutomation}
                  className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
                >
                  {resumingAutomation ? "Resuming…" : "Resume Automation"}
                </button>
              </div>
            )}

            {/* Chat message list area */}
            <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-6 bg-[#060608] space-y-4">
              {loadingChat ? (
                <div className="text-center py-20 text-zinc-500 text-sm">Loading full chat log...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 text-sm">No messages in this chat.</div>
              ) : (
                messages.map((m) => {
                  const isContact = m.sender === "contact";
                  const isSystem = m.sender === "system";
                  
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isContact ? "justify-start" : isSystem ? "justify-center" : "justify-end"}`}
                    >
                      {isSystem ? (
                        <div className="bg-zinc-900 text-zinc-400 text-[11px] px-3 py-2 rounded-xl max-w-md border border-zinc-800 shadow-md font-sans space-y-2">
                          <div className="flex items-start justify-center gap-1.5 text-center">
                            <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-semibold text-zinc-300">{m.senderName}:</span> {m.content}
                            </div>
                          </div>

                          {m.retryOfMessageId && (
                            <div className="text-[9px] uppercase tracking-wide text-zinc-500 text-center">
                              Retry of failed message #{m.retryOfMessageId}
                            </div>
                          )}

                          {m.status === "failed" && (m.failureTitle || m.failureDetails) && (
                            <div className="rounded-lg border border-red-900/70 bg-red-950/40 px-2 py-1.5 text-left text-red-200">
                              <div className="font-semibold">{m.failureTitle || "WhatsApp delivery failed"}</div>
                              {m.failureDetails && <div className="mt-0.5 text-[10px] text-red-300">{m.failureDetails}</div>}
                              {m.failureCode && <div className="mt-0.5 text-[9px] text-red-400">Code: {m.failureCode}</div>}
                            </div>
                          )}

                          <div className="flex items-center justify-center gap-2 border-t border-zinc-800 pt-1.5" title={getDeliveryStatusTitle(m)}>
                            <span className={`flex items-center gap-1 font-semibold ${m.status === "failed" ? "text-red-400" : m.status === "read" ? "text-sky-400" : "text-zinc-500"}`}>
                              {m.status === "failed" ? (
                                <AlertCircle className="h-3 w-3" />
                              ) : m.status === "sent" ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {getDeliveryStatusLabel(m)}
                            </span>
                            <span className="text-zinc-600">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {m.status === "failed" && m.messageType === "text" && (
                              <button
                                type="button"
                                onClick={() => void handleRetryMessage(m)}
                                disabled={(!freeFormMessagingAllowed && m.replyType !== "template") || retryingMessageId !== null}
                                className="inline-flex items-center gap-1 rounded-md border border-red-800 px-2 py-0.5 text-[9px] font-semibold text-red-300 hover:bg-red-950 disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3 w-3 ${retryingMessageId === m.id ? "animate-spin" : ""}`} />
                                {retryingMessageId === m.id ? "Retrying" : "Retry"}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`max-w-md rounded-2xl p-4 shadow-xl relative group ${
                            isContact
                              ? "bg-zinc-900 text-zinc-100 rounded-tl-none border border-zinc-800"
                              : "bg-emerald-600 text-white rounded-tr-none"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenActionMenuId(openActionMenuId === m.id ? null : m.id)}
                            className={`absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition ${
                              isContact ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-emerald-700 text-emerald-100"
                            }`}
                            aria-label="Message actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openActionMenuId === m.id && (
                            <div className={`absolute z-50 top-7 w-48 rounded-xl border border-zinc-700 bg-[#111114] shadow-2xl py-1 text-zinc-200 ${
                              isContact ? "left-2" : "right-2"
                            }`}>
                              <button onClick={() => { setReplyingTo(m); setOpenActionMenuId(null); }} className="w-full px-3 py-2 text-xs flex items-center gap-2 hover:bg-zinc-800">
                                <Reply className="h-3.5 w-3.5" /> Reply
                              </button>
                              {!m.deletedForEveryone && (
                                <button onClick={() => setForwardingMessage(m)} className="w-full px-3 py-2 text-xs flex items-center gap-2 hover:bg-zinc-800">
                                  <Forward className="h-3.5 w-3.5" /> Forward
                                </button>
                              )}
                              <button onClick={() => void updateMessageState(m, { isPinned: !m.isPinned })} className="w-full px-3 py-2 text-xs flex items-center gap-2 hover:bg-zinc-800">
                                <Pin className="h-3.5 w-3.5" /> {m.isPinned ? "Unpin" : "Pin"}
                              </button>
                              <button onClick={() => void updateMessageState(m, { isStarred: !m.isStarred })} className="w-full px-3 py-2 text-xs flex items-center gap-2 hover:bg-zinc-800">
                                <Star className="h-3.5 w-3.5" /> {m.isStarred ? "Unstar" : "Star"}
                              </button>
                            </div>
                          )}

                          {m.repliedMessage && (
                            <div className={`mb-2 rounded-lg border-l-4 p-2 text-xs ${
                              isContact ? "bg-black/25 border-emerald-500 text-zinc-400" : "bg-emerald-800/60 border-white/70 text-emerald-100"
                            }`}>
                              <div className="font-bold mb-0.5">{m.repliedMessage.senderName}</div>
                              <div className="truncate">
                                {m.repliedMessage.deletedForEveryone ? "This message was deleted" : m.repliedMessage.content}
                              </div>
                            </div>
                          )}

                          {m.hasUnmatchedReplyContext && !m.repliedMessage && (
                            <div className={`mb-2 rounded-lg border-l-4 p-2 text-xs italic ${
                              isContact ? "bg-black/25 border-amber-500 text-zinc-400" : "bg-emerald-800/60 border-amber-300 text-emerald-100"
                            }`}>
                              Reply to an older WhatsApp message whose original reference is unavailable
                            </div>
                          )}

                          {m.forwardedFromMessageId && (
                            <div className={`mb-1 text-[10px] italic flex items-center gap-1 ${isContact ? "text-zinc-500" : "text-emerald-200"}`}>
                              <Forward className="h-3 w-3" /> Forwarded
                            </div>
                          )}

                          {m.metaMediaId && (
                            <MessageMedia message={m} token={token} />
                          )}

                          {m.deletedForEveryone ? (
                            <p className={`text-sm italic ${isContact ? "text-zinc-500" : "text-emerald-100"}`}>
                              This message was deleted
                            </p>
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap pr-3">{m.content}</p>
                          )}

                          {m.retryOfMessageId && (
                            <div className={`mt-2 text-[9px] uppercase tracking-wide ${isContact ? "text-zinc-600" : "text-emerald-200"}`}>
                              Retry of failed message #{m.retryOfMessageId}
                            </div>
                          )}

                          {!isContact && m.status === "failed" && (m.failureTitle || m.failureDetails) && (
                            <div className="mt-2 rounded-lg border border-red-900/70 bg-red-950/45 px-2.5 py-2 text-red-100">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {m.failureTitle || "WhatsApp delivery failed"}
                              </div>
                              {m.failureDetails && <div className="mt-1 text-[10px] text-red-200">{m.failureDetails}</div>}
                              {m.failureCode && <div className="mt-1 text-[9px] text-red-300">Code: {m.failureCode}</div>}
                            </div>
                          )}
                          
                          {/* Time, delivery state, and reply type */}
                          <div className="flex items-center justify-between gap-4 mt-2">
                            <div className="flex items-center gap-1.5">
                              {m.isPinned && <Pin className={`h-3 w-3 ${isContact ? "text-zinc-500" : "text-emerald-200"}`} />}
                              {m.isStarred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                              <span className={`text-[9px] ${isContact ? "text-zinc-500" : "text-emerald-200"} font-mono`}>
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            
                            {!isContact && (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                    m.status === "failed"
                                      ? "bg-red-950/70 text-red-200"
                                      : m.status === "read"
                                        ? "bg-sky-950/60 text-sky-200"
                                        : "bg-emerald-800/70 text-emerald-100"
                                  }`}
                                  title={getDeliveryStatusTitle(m)}
                                >
                                  {m.status === "failed" ? (
                                    <AlertCircle className="h-3 w-3" />
                                  ) : m.status === "sent" ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  {getDeliveryStatusLabel(m)}
                                </span>

                                {m.status === "failed" && m.messageType === "text" && (
                                  <button
                                    type="button"
                                    onClick={() => void handleRetryMessage(m)}
                                    disabled={(!freeFormMessagingAllowed && m.replyType !== "template") || retryingMessageId !== null}
                                    className="inline-flex items-center gap-1 rounded border border-red-300/50 px-1.5 py-0.5 text-[9px] font-semibold text-red-50 hover:bg-red-950/40 disabled:opacity-50"
                                  >
                                    <RefreshCw className={`h-3 w-3 ${retryingMessageId === m.id ? "animate-spin" : ""}`} />
                                    {retryingMessageId === m.id ? "Retrying" : "Retry"}
                                  </button>
                                )}

                                {m.replyType && m.replyType !== "none" && (
                                  <span className="text-[9px] bg-emerald-750 text-emerald-100 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                    {m.replyType === "handover" ? "handover notice" : `${m.replyType} reply`}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Suggestion Deck */}
            {selectedConversation.status !== "closed" && (
              <div className="px-6 py-4 bg-emerald-950/15 border-t border-zinc-900 z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
                    <h4 className="text-xs font-bold text-emerald-300 tracking-tight uppercase">
                      Grounded AI Reply Suggestions
                    </h4>
                  </div>
                  {suggestions.length === 0 ? (
                    <button
                      onClick={fetchAISuggestions}
                      disabled={loadingSuggestions}
                      className="text-[11px] bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-500 transition font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md"
                    >
                      {loadingSuggestions ? "Generating..." : "Generate AI Suggestions"}
                      <RefreshCw className={`h-3 w-3 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                    </button>
                  ) : (
                    <button
                      onClick={fetchAISuggestions}
                      disabled={loadingSuggestions}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      Regenerate
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-[10px] text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Only approved Knowledge Base, FAQ, rules, approved replies, contact profile, and conversation context are used. Unsupported facts are blocked.</span>
                </div>

                {suggestionError && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-900/60 bg-amber-950/25 px-3 py-2 text-[11px] text-amber-300">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{suggestionError}</span>
                  </div>
                )}

                {suggestionSourceSummary && suggestions.length > 0 && (
                  <div className="text-[10px] text-zinc-500">Grounded sources: {suggestionSourceSummary}</div>
                )}

                {suggestions.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {suggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0c0c0e] border border-zinc-800 rounded-xl p-3 shadow-md hover:border-zinc-750 transition flex flex-col justify-between"
                      >
                        <p className="text-xs text-zinc-300 leading-relaxed italic">"{sug}"</p>
                        <div className="flex items-center justify-between gap-1 mt-3 border-t border-zinc-900 pt-2 shrink-0">
                          {/* Training metrics */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleTrainAI(sug, true)}
                              className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 rounded transition cursor-pointer"
                              title="Approve this reply as a future grounded example"
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleTrainAI(sug, false)}
                              className="p-1 hover:bg-rose-950/30 text-zinc-500 hover:text-rose-400 rounded transition cursor-pointer"
                              title="Reject this reply; it will not be used as trusted knowledge"
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </button>
                          </div>
                          
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setReplyText(sug)}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                              title="Insert to text field"
                            >
                              <Clipboard className="h-3 w-3" /> Insert
                            </button>
                            <button
                              onClick={() => handleSendMessage(sug, "ai")}
                              disabled={!freeFormMessagingAllowed}
                              className="text-[10px] bg-emerald-600 text-white hover:bg-emerald-500 px-2.5 py-1 rounded-md font-semibold transition cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed"
                              title={freeFormMessagingAllowed
                                ? "Send this grounded suggestion"
                                : "The WhatsApp 24-hour service window is closed"}
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Outgoing Message Entry (24-hour customer service window) */}
            <div className="p-4 border-t border-zinc-900 bg-[#0c0c0e] relative">
              <div className={`mb-3 rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5 ${
                freeFormMessagingAllowed
                  ? "border-emerald-500/25 bg-emerald-500/8"
                  : "border-amber-500/35 bg-amber-500/10"
              }`}>
                {freeFormMessagingAllowed ? (
                  <Clock className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-[11px] font-bold ${
                    freeFormMessagingAllowed ? "text-emerald-300" : "text-amber-300"
                  }`}>
                    {freeFormMessagingAllowed
                      ? `WhatsApp service window open · ${formatServiceWindowRemaining(serviceWindow.remainingSeconds)}`
                      : "WhatsApp 24-hour service window closed"}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${
                    freeFormMessagingAllowed ? "text-emerald-100/60" : "text-amber-100/70"
                  }`}>
                    {freeFormMessagingAllowed
                      ? `Free-form replies are allowed until ${serviceWindow.expiresAt?.toLocaleString() || "the window expires"}.`
                      : "Free-form text, attachments, AI replies, and free-form retries are blocked. An approved Meta template can still be sent."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMetaTemplatePanel(previous => !previous)}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition ${
                    freeFormMessagingAllowed
                      ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/60"
                      : "border-amber-500/40 bg-amber-950/35 text-amber-200 hover:bg-amber-950/60"
                  }`}
                >
                  {showMetaTemplatePanel ? "Close Templates" : "Send Approved Template"}
                </button>
              </div>

              {showMetaTemplatePanel && (
                <div className="mb-3 overflow-hidden rounded-xl border border-zinc-800 bg-[#09090b] shadow-2xl">
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-100">
                        <FileText className="h-4 w-4 text-emerald-400" /> Meta-approved Message Templates
                      </div>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        Templates are created and approved in WhatsApp Manager, then synced here.
                      </p>
                    </div>
                    {(["super_admin", "admin"].includes(currentUser.role)) && (
                      <button
                        type="button"
                        onClick={() => void handleSyncMetaTemplates()}
                        disabled={syncingMetaTemplates}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[10px] font-bold text-zinc-300 hover:border-emerald-700 hover:text-emerald-300 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${syncingMetaTemplates ? "animate-spin" : ""}`} />
                        {syncingMetaTemplates ? "Syncing" : "Sync from Meta"}
                      </button>
                    )}
                  </div>

                  <div className="border-b border-zinc-800 px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-[9px] font-semibold">
                      <span className="rounded bg-emerald-950 px-2 py-1 text-emerald-400">Approved {metaTemplates.filter(item => !item.isArchived && item.status === "APPROVED").length}</span>
                      <span className="rounded bg-amber-950 px-2 py-1 text-amber-400">Pending {metaTemplates.filter(item => !item.isArchived && item.status === "PENDING").length}</span>
                      <span className="rounded bg-rose-950 px-2 py-1 text-rose-400">Rejected {metaTemplates.filter(item => !item.isArchived && item.status === "REJECTED").length}</span>
                      <span className="rounded bg-zinc-900 px-2 py-1 text-zinc-400">Archived {metaTemplates.filter(item => item.isArchived).length}</span>
                    </div>
                    {metaTemplateSyncNotice && (
                      <div className={`mt-2 rounded-lg border px-3 py-2 text-[10px] leading-relaxed ${metaTemplateSyncNotice.toLowerCase().includes("complete") ? "border-emerald-900 bg-emerald-950/30 text-emerald-300" : "border-amber-900 bg-amber-950/30 text-amber-300"}`}>
                        {metaTemplateSyncNotice}
                      </div>
                    )}
                  </div>

                  <div className="grid max-h-[420px] grid-cols-1 md:grid-cols-2">
                    <div className="border-b border-zinc-800 p-3 md:border-b-0 md:border-r">
                      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600" />
                          <input
                            value={metaTemplateSearch}
                            onChange={event => setMetaTemplateSearch(event.target.value)}
                            placeholder="Search templates..."
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-emerald-700"
                          />
                        </div>
                        <select
                          value={metaTemplateStatusFilter}
                          onChange={event => setMetaTemplateStatusFilter(event.target.value)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-[10px] text-zinc-300 outline-none focus:border-emerald-700"
                        >
                          <option value="active">Active</option>
                          <option value="APPROVED">Approved</option>
                          <option value="PENDING">Pending</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="archived">Archived</option>
                          <option value="all">All</option>
                        </select>
                      </div>
                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                        {loadingMetaTemplates ? (
                          <div className="py-8 text-center text-xs text-zinc-500">Loading templates…</div>
                        ) : metaTemplates.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
                            No templates are synced for this WhatsApp line.
                          </div>
                        ) : metaTemplates
                            .filter(template => {
                              const needle = metaTemplateSearch.trim().toLowerCase();
                              const matchesSearch = !needle || `${template.name} ${template.language} ${template.category}`.toLowerCase().includes(needle);
                              const matchesStatus = metaTemplateStatusFilter === "all"
                                || (metaTemplateStatusFilter === "active" && !template.isArchived)
                                || (metaTemplateStatusFilter === "archived" && Boolean(template.isArchived))
                                || (!template.isArchived && template.status === metaTemplateStatusFilter);
                              return matchesSearch && matchesStatus;
                            })
                            .map(template => {
                              const selectable = template.canSend !== false && template.status === "APPROVED" && template.supported !== false && !template.isArchived;
                              return (
                                <button
                                  key={template.id}
                                  type="button"
                                  disabled={!selectable}
                                  onClick={() => handleChooseMetaTemplate(template)}
                                  className={`w-full rounded-lg border p-3 text-left transition ${
                                    selectedMetaTemplate?.id === template.id
                                      ? "border-emerald-600 bg-emerald-950/30"
                                      : selectable
                                        ? "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                                        : "cursor-not-allowed border-zinc-900 bg-zinc-950/50 opacity-55"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-bold text-zinc-200">{template.name}</div>
                                      <div className="mt-0.5 text-[10px] text-zinc-500">{template.language} · {template.category}</div>
                                    </div>
                                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                      template.status === "APPROVED"
                                        ? "bg-emerald-950 text-emerald-400"
                                        : template.status === "REJECTED"
                                          ? "bg-rose-950 text-rose-400"
                                          : "bg-amber-950 text-amber-400"
                                    }`}>{template.status}</span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
                                    {template.isArchived && <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-400">ARCHIVED</span>}
                                    {template.isStale && !template.isArchived && <span className="rounded bg-amber-950 px-1.5 py-0.5 text-amber-400">SYNC REQUIRED</span>}
                                    {template.qualityScore && <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-400">Quality {template.qualityScore}</span>}
                                  </div>
                                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-[10px] leading-relaxed text-zinc-500">
                                    {template.sendBlockReason || template.unsupportedReason || template.previewText}
                                  </p>
                                </button>
                              );
                            })}
                      </div>
                    </div>

                    <div className="max-h-[380px] overflow-y-auto p-4">
                      {!selectedMetaTemplate ? (
                        <div className="flex h-full min-h-40 items-center justify-center text-center text-xs text-zinc-500">
                          Select an approved template to preview and send it.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-bold text-zinc-100">{selectedMetaTemplate.name}</div>
                            <div className="text-[10px] text-zinc-500">{selectedMetaTemplate.language} · {selectedMetaTemplate.category}</div>
                          </div>

                          <div className="whitespace-pre-line rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300">
                            {selectedMetaTemplate.previewText}
                          </div>

                          {(selectedMetaTemplate.parameterDefinitions || []).map(definition => (
                            <label key={definition.key} className="block">
                              <span className="mb-1 block text-[10px] font-semibold text-zinc-400">{definition.label}</span>
                              <input
                                type={definition.parameterType === "text" ? "text" : "url"}
                                value={metaTemplateValues[definition.key] || ""}
                                onChange={event => setMetaTemplateValues(previous => ({
                                  ...previous,
                                  [definition.key]: event.target.value,
                                }))}
                                placeholder={definition.parameterType === "text" ? "Enter approved value" : "https://..."}
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-700"
                              />
                            </label>
                          ))}

                          {selectedMetaTemplate.sendBlockReason && (
                            <div className="rounded-lg border border-amber-900 bg-amber-950/30 px-3 py-2 text-[10px] leading-relaxed text-amber-300">
                              {selectedMetaTemplate.sendBlockReason}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleSendMetaTemplate()}
                            disabled={sendingMetaTemplate || selectedMetaTemplate.canSend === false}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500"
                          >
                            {sendingMetaTemplate ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            {sendingMetaTemplate ? "Sending Template" : "Send Approved Template"}
                          </button>
                          <p className="text-[9px] leading-relaxed text-zinc-600">
                            This can be sent even when the 24-hour service window is closed. Meta may charge according to the template category and destination.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {replyingTo && (
                <div className="mb-2 flex items-stretch rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                  <div className="w-1 bg-emerald-500" />
                  <div className="flex-1 px-3 py-2 min-w-0">
                    <div className="text-[11px] font-bold text-emerald-400">{replyingTo.senderName}</div>
                    <div className="text-xs text-zinc-400 truncate">
                      {replyingTo.deletedForEveryone ? "This message was deleted" : replyingTo.content}
                    </div>
                  </div>
                  <button type="button" onClick={() => setReplyingTo(null)} className="px-3 text-zinc-500 hover:text-zinc-200">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {/* Quick Reply Autocomplete or Toggle Dropdown */}
              {(showQuickReplyMenu || showQuickRepliesButtonMenu) && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#09090b] border border-zinc-850 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 flex flex-col divide-y divide-zinc-800">
                  <div className="px-3 py-1.5 bg-zinc-950/80 flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-850 shrink-0">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                      <Zap className="h-3 w-3" /> Quick Replies
                    </span>
                    <span>Use Arrow keys & Enter or Click to select</span>
                  </div>
                  <div className="overflow-y-auto divide-y divide-zinc-900/60 max-h-40">
                    {(showQuickReplyMenu ? filteredReplies : quickReplies).map((qr, idx) => (
                      <button
                        key={qr.id}
                        type="button"
                        onClick={() => insertQuickReply(qr)}
                        className={`w-full text-left px-3 py-2 flex items-start gap-3 text-xs transition cursor-pointer ${
                          showQuickReplyMenu && idx === activeReplyIndex
                            ? "bg-emerald-950/40 text-emerald-300 font-medium"
                            : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                        }`}
                      >
                        <span className="font-mono font-bold text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-emerald-900/40 mt-0.5">
                          /{qr.shortcut}
                        </span>
                        <span className="truncate leading-normal">{qr.message}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

                <>
                {attachment && (
                  <div className="mb-2 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2">
                    <Paperclip className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-zinc-200">{attachment.filename}</div>
                      <div className="text-[10px] text-zinc-500">{attachment.mimeType}</div>
                    </div>
                    <button type="button" onClick={() => setAttachment(null)} className="p-1 text-zinc-500 hover:text-zinc-200">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage(replyText, "manual");
                  }}
                  className="flex gap-3 items-end"
                >
                  <div className="flex-1 bg-zinc-900 border border-zinc-850 rounded-xl px-4 py-2 flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                      onChange={event => {
                        selectAttachment(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!freeFormMessagingAllowed}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={freeFormMessagingAllowed
                        ? "Attach photo, video, audio, or document"
                        : "The 24-hour service window is closed"}
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <textarea
                      rows={1}
                      placeholder={freeFormMessagingAllowed
                        ? "Type a manual candidate reply (type '/' for templates)..."
                        : "24-hour window closed — use an approved Meta template"}
                      value={replyText}
                      onChange={(e) => handleTextareaChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={!freeFormMessagingAllowed}
                      className="flex-1 bg-transparent border-0 outline-none text-sm text-zinc-100 focus:ring-0 resize-none max-h-24 font-sans py-1 placeholder-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={() => void toggleVoiceRecording()}
                      disabled={!freeFormMessagingAllowed}
                      className={`p-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        isRecording
                          ? "bg-rose-500 text-white animate-pulse"
                          : "text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800"
                      }`}
                      title={isRecording ? "Stop voice recording" : "Record voice message"}
                    >
                      {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
                    </button>
                    {quickReplies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickRepliesButtonMenu(!showQuickRepliesButtonMenu);
                          setShowQuickReplyMenu(false);
                        }}
                        disabled={!freeFormMessagingAllowed}
                        className={`p-1.5 rounded-lg hover:bg-[#1a1a24] transition cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                          showQuickRepliesButtonMenu ? "text-emerald-400 bg-zinc-800" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                        title="Canned Quick Replies"
                      >
                        <Zap className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!freeFormMessagingAllowed || sendingReply || (!replyText.trim() && !attachment)}
                    className="h-11 w-11 shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl flex items-center justify-center transition shadow-lg shadow-emerald-950/20 cursor-pointer"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
                </>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-[#060608] p-6 text-center">
            <div className="h-16 w-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 mb-4 shadow-lg">
              <MessageCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-zinc-200 font-bold text-base tracking-tight">No Chat Selected</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">
              Select a conversation from the left thread rail to view candidate log histories, trigger AI responses, or manage active onboarding steps.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right Panel: Detailed Contact Profile */}
      <div className="w-80 border-l border-zinc-900 bg-[#0c0c0e] flex flex-col overflow-y-auto">
        {selectedConversation && contact ? (
          <div className="p-6 space-y-6">
            
            {/* Contact title card */}
            <div className="text-center space-y-2 border-b border-zinc-900 pb-5">
              <div className="inline-flex h-16 w-16 items-center justify-center bg-emerald-950/60 text-emerald-400 border border-emerald-900/30 font-bold text-2xl rounded-full shadow-inner">
                {contact.name ? contact.name.charAt(0) : <User />}
              </div>
              <div>
                <h4 className="font-bold text-zinc-100 text-base">
                  {contact.name || "WhatsApp Candidate"}
                </h4>
                <span className="text-xs text-zinc-400 font-mono mt-1 block">
                  {contact.phoneNumber}
                </span>
              </div>
              <div className="flex justify-center gap-2 pt-1">
                <span className="text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {contact.clientCandidateType}
                </span>
                <span className="text-[10px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {contact.status}
                </span>
              </div>
            </div>

            {/* Quick Note Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Internal notes</label>
              <textarea
                value={contact.notes || ""}
                onChange={(e) => setContact({ ...contact, notes: e.target.value })}
                onBlur={() => handleSaveContactProfile({ notes: contact.notes })}
                className="w-full text-xs border border-zinc-800 rounded-xl p-3 bg-zinc-900/50 text-zinc-200 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-600"
                placeholder="Add recruiting details or next interview dates here..."
                rows={3}
              />
            </div>

            {/* Candidate Info Fields */}
            <div className="space-y-4">
              <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-900 pb-2">
                {contact.clientCandidateType === "client" ? "Client & Hiring Details" : "Candidate Details"}
              </h5>

              <div className="space-y-3 text-xs">
                
                {contact.clientCandidateType === "candidate" && (
                  <>
                {/* CV/Link */}
                <div>
                  <span className="text-zinc-500 block mb-1">CV / LinkedIn Link</span>
                  <input
                    type="text"
                    value={contact.cvField || ""}
                    onChange={(e) => setContact({ ...contact, cvField: e.target.value })}
                    onBlur={() => handleSaveContactProfile({ cvField: contact.cvField })}
                    placeholder="Paste link here..."
                    className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900/50 text-zinc-200 placeholder-zinc-600"
                  />
                  {contact.cvField && (
                    <a
                      href={contact.cvField}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-400 hover:underline mt-1 inline-block font-semibold"
                    >
                      Open CV Link ↗
                    </a>
                  )}
                </div>

                {/* Desired Role */}
                <div>
                  <span className="text-zinc-500 block mb-1">Interested Job Role</span>
                  <input
                    type="text"
                    value={contact.interestedJobRole || ""}
                    onChange={(e) => setContact({ ...contact, interestedJobRole: e.target.value })}
                    onBlur={() => handleSaveContactProfile({ interestedJobRole: contact.interestedJobRole })}
                    placeholder="e.g. React Developer"
                    className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900/50 text-zinc-200 placeholder-zinc-600"
                  />
                </div>

                {/* Expected Salary */}
                <div>
                  <span className="text-zinc-500 block mb-1">Expected Salary</span>
                  <input
                    type="text"
                    value={contact.expectedSalary || ""}
                    onChange={(e) => setContact({ ...contact, expectedSalary: e.target.value })}
                    onBlur={() => handleSaveContactProfile({ expectedSalary: contact.expectedSalary })}
                    placeholder="e.g. $120,000"
                    className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900/50 text-zinc-200 placeholder-zinc-600"
                  />
                </div>

                {/* Location */}
                <div>
                  <span className="text-zinc-500 block mb-1">Candidate Location</span>
                  <input
                    type="text"
                    value={contact.location || ""}
                    onChange={(e) => setContact({ ...contact, location: e.target.value })}
                    onBlur={() => handleSaveContactProfile({ location: contact.location })}
                    placeholder="e.g. London, UK"
                    className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900/50 text-zinc-200 placeholder-zinc-600"
                  />
                </div>

                {/* Experience */}
                <div>
                  <span className="text-zinc-500 block mb-1">Years of Experience</span>
                  <input
                    type="text"
                    value={contact.experience || ""}
                    onChange={(e) => setContact({ ...contact, experience: e.target.value })}
                    onBlur={() => handleSaveContactProfile({ experience: contact.experience })}
                    placeholder="e.g. 5 years"
                    className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900/50 text-zinc-200 placeholder-zinc-600"
                  />
                </div>
                  </>
                )}

                {contact.clientCandidateType === "client" && (
                  <>
                    {([
                      ["companyName", "Company Name", "e.g. Acme Holdings"],
                      ["companyWebsite", "Company Website", "https://company.com"],
                      ["industry", "Industry", "e.g. Technology, Hospitality"],
                      ["contactDesignation", "Contact Person Designation", "e.g. HR Manager"],
                      ["hiringRequirements", "Hiring Roles / Requirements", "e.g. 3 Sales Executives"],
                      ["vacancyCount", "Number of Vacancies", "e.g. 5"],
                      ["hiringBudget", "Hiring Budget / Salary Range", "e.g. LKR 150,000–250,000"],
                      ["companyLocation", "Company / Job Location", "e.g. Colombo 03"],
                    ] as const).map(([field, label, placeholder]) => (
                      <div key={field}>
                        <span className="text-zinc-500 block mb-1">{label}</span>
                        {field === "hiringRequirements" ? (
                          <textarea
                            rows={3}
                            value={contact[field] || ""}
                            onChange={(e) => setContact({ ...contact, [field]: e.target.value })}
                            onBlur={() => handleSaveContactProfile({ [field]: contact[field] })}
                            placeholder={placeholder}
                            className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900/50 text-zinc-200 placeholder-zinc-600 resize-none"
                          />
                        ) : (
                          <input
                            type={field === "companyWebsite" ? "url" : "text"}
                            value={contact[field] || ""}
                            onChange={(e) => setContact({ ...contact, [field]: e.target.value })}
                            onBlur={() => handleSaveContactProfile({ [field]: contact[field] })}
                            placeholder={placeholder}
                            className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900/50 text-zinc-200 placeholder-zinc-600"
                          />
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Client or Candidate Type */}
                <div>
                  <span className="text-zinc-500 block mb-1">Recruitment Type</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const updated = "candidate";
                        setContact({ ...contact, clientCandidateType: updated });
                        handleSaveContactProfile({ clientCandidateType: updated });
                      }}
                      className={`flex-1 text-center py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
                        contact.clientCandidateType === "candidate"
                          ? "bg-emerald-950/40 border-emerald-900/40 text-emerald-400"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      Candidate
                    </button>
                    <button
                      onClick={() => {
                        const updated = "client";
                        setContact({ ...contact, clientCandidateType: updated });
                        handleSaveContactProfile({ clientCandidateType: updated });
                      }}
                      className={`flex-1 text-center py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
                        contact.clientCandidateType === "client"
                          ? "bg-indigo-950/40 border-indigo-900/40 text-indigo-400"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      Client
                    </button>
                  </div>
                </div>

                {/* Tags input */}
                <div>
                  <span className="text-zinc-500 block mb-1">Tags (Comma-separated)</span>
                  <input
                    type="text"
                    value={contact.tags || ""}
                    onChange={(e) => setContact({ ...contact, tags: e.target.value })}
                    onBlur={() => handleSaveContactProfile({ tags: contact.tags })}
                    placeholder="e.g. Candidate, React, London"
                    className="w-full border border-zinc-800 rounded-lg p-2 bg-zinc-900/50 text-zinc-200 placeholder-zinc-600"
                  />
                </div>

              </div>
            </div>

             {/* Workflow Captured Answers Block */}
            {contact.capturedAnswers && contact.capturedAnswers !== "{}" && (
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-900 pb-2">
                  Workflow Answers
                </h5>
                <div className="bg-zinc-950/45 p-3 rounded-xl border border-zinc-850 space-y-2 text-xs text-zinc-300">
                  {(() => {
                    try {
                      return Object.entries(JSON.parse(contact.capturedAnswers || "{}")).map(([key, val]) => (
                        <div key={key} className="flex flex-col">
                          <span className="text-zinc-500 capitalize">{key.replace("step_", "")}:</span>
                          <span className="font-semibold text-zinc-200 leading-normal">{String(val)}</span>
                        </div>
                      ));
                    } catch (e) {
                      return <span className="text-zinc-500">No captured answers.</span>;
                    }
                  })()}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500 text-xs">No profile details loaded.</div>
        )}
      </div>

    </div>
  );
}
