import React, { useState, useEffect, useRef } from "react";
import { 
  Search, MessageCircle, AlertCircle, Sparkles, Send, Clock, User, Check,
  Tags, Info, CheckCircle2, ChevronRight, CornerDownRight, ThumbsUp, ThumbsDown,
  RefreshCw, Clipboard, Paperclip, CheckSquare, Plus, Lock, Calendar, Zap,
  MoreVertical, Reply, Forward, Pin, Star, X
} from "lucide-react";
import { Contact, Conversation, Message } from "../types.ts";

interface InboxProps {
  token: string;
  currentUser: any;
}

export default function Inbox({ token, currentUser }: InboxProps) {
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
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);

  // Quick Replies State
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [showQuickReplyMenu, setShowQuickReplyMenu] = useState(false);
  const [showQuickRepliesButtonMenu, setShowQuickRepliesButtonMenu] = useState(false);
  const [filteredReplies, setFilteredReplies] = useState<any[]>([]);
  const [activeReplyIndex, setActiveReplyIndex] = useState(0);

  // AI suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Users for assignment selection
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // 24 hour state
  const [isPast24Hours, setIsPast24Hours] = useState(false);
  const [lastIncomingTime, setLastIncomingTime] = useState<Date | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  // Keep the thread rail in sync with inbound webhook messages. The webhook
  // marks the conversation as unread; polling makes that state visible without
  // requiring the recruiter to manually refresh the inbox.
  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchConversations();
      }
    }, 5000);

    return () => window.clearInterval(refreshInterval);
  }, [filter, assignedToMe, search, token, selectedConversation?.id]);

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
            `${message.id}:${message.isStarred}:${message.isPinned}:${message.replyToMessageId || ""}`
          ).join("|");
          const updatedSignature = updatedMessages.map(message =>
            `${message.id}:${message.isStarred}:${message.isPinned}:${message.replyToMessageId || ""}`
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
    setContact(null);
    setReplyText("");

    try {
      // 1. Fetch details
      const response = await fetch(`/api/conversations/${conv.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContact(data.contact);
      }

      // 2. Fetch messages
      const mRes = await fetch(`/api/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (mRes.ok) {
        const mData = await mRes.json();
        setMessages(mData);

        // 3. Compute 24 hours window
        const incoming = mData.filter((m: any) => m.sender === "contact");
        if (incoming.length > 0) {
          const lastIncomingMsg = incoming[incoming.length - 1];
          const lastTime = new Date(lastIncomingMsg.timestamp);
          setLastIncomingTime(lastTime);
          
          const hoursDiff = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);
          setIsPast24Hours(hoursDiff > 24);
        } else {
          setIsPast24Hours(true);
          setLastIncomingTime(null);
        }
      }

      // 4. Mark as open/read automatically if unread
      if (conv.status === "unread") {
        await fetch(`/api/conversations/${conv.id}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status: "open" })
        });
        fetchConversations(conv.id);
      }

      // 5. Fetch Quick Replies for this WhatsApp line
      const qrRes = await fetch(`/api/whatsapp_numbers/${conv.whatsappNumberId}/quick-replies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        setQuickReplies(qrData);
        setFilteredReplies(qrData);
      }
    } catch (err) {
      console.error("Error loading chat details:", err);
    } finally {
      setLoadingChat(false);
    }
  };

  // Fetch AI suggestions
  const fetchAISuggestions = async () => {
    if (!selectedConversation) return;
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/ai-suggestions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Auto-scroll to message end
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // Send Message
  const handleSendMessage = async (text: string, replyType: 'manual' | 'ai' | 'workflow' = 'manual') => {
    if (!selectedConversation || !text.trim() || !contact) return;
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
      setReplyingTo(null);
      setSuggestions([]); // Clear suggestions upon reply

      // Reload conversation list
      fetchConversations(selectedConversation.id);
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSendingReply(false);
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

  // Quick Action Toggles on Conversation
  const handleUpdateConvStatus = async (status: string) => {
    if (!selectedConversation) return;
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
      await fetch("/api/ai-suggestions/train", {
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
      alert(isApproved ? "Suggestion marked as good. AI will prioritize similar replies!" : "Suggestion marked as bad.");
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
              if (conv.status === "unread") {
                statusLabel = "Unread";
                statusClass = "bg-amber-950/40 text-amber-400 border border-amber-900/40";
              } else if (conv.status === "human_handover") {
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
                    conv.status === "unread"
                      ? "bg-emerald-950/25 border-l-4 border-emerald-400 hover:bg-emerald-950/40"
                      : "hover:bg-zinc-900/40 border-l-4 border-transparent"
                  } ${
                    isSelected ? "ring-1 ring-inset ring-emerald-500/50" : ""
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 min-w-0">
                      {conv.status === "unread" && (
                        <span
                          className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] shrink-0"
                          aria-label="Unread conversation"
                        />
                      )}
                      <h4 className={`text-sm truncate max-w-[150px] ${
                        conv.status === "unread" ? "font-bold text-white" : "font-semibold text-zinc-200"
                      }`}>
                        {conv.contactName || conv.contactPhone}
                      </h4>
                    </div>
                    <span className={`text-xs shrink-0 ${
                      conv.status === "unread" ? "font-semibold text-emerald-300" : "text-zinc-500"
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
                  className="border border-zinc-800 rounded-lg text-xs py-1 px-1.5 bg-zinc-900 focus:ring-1 focus:ring-emerald-500 text-zinc-300 font-semibold"
                >
                  <option value="open">Open</option>
                  <option value="human_handover">Recruiter Handover</option>
                  <option value="workflow_active">Workflow Active</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Chat message list area */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#060608] space-y-4">
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
                        <div className="bg-zinc-900 text-zinc-400 text-[11px] px-3 py-1.5 rounded-xl max-w-md border border-zinc-800 text-center shadow-md flex items-center gap-1.5 font-sans">
                          <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500" />
                          <div>
                            <span className="font-semibold text-zinc-300">{m.senderName}:</span> {m.content}
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

                          {m.deletedForEveryone ? (
                            <p className={`text-sm italic ${isContact ? "text-zinc-500" : "text-emerald-100"}`}>
                              This message was deleted
                            </p>
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap pr-3">{m.content}</p>
                          )}
                          
                          {/* Micro indicator of replies */}
                          <div className="flex items-center justify-between gap-4 mt-2">
                            <div className="flex items-center gap-1.5">
                              {m.isPinned && <Pin className={`h-3 w-3 ${isContact ? "text-zinc-500" : "text-emerald-200"}`} />}
                              {m.isStarred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                              <span className={`text-[9px] ${isContact ? "text-zinc-500" : "text-emerald-200"} font-mono`}>
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            
                            {!isContact && m.replyType && m.replyType !== "none" && (
                              <span className="text-[9px] bg-emerald-750 text-emerald-100 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                {m.replyType} reply
                              </span>
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
                      AI Generated Recruiting Suggestions
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
                              title="Mark suggestion as Good reply (Trains AI)"
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleTrainAI(sug, false)}
                              className="p-1 hover:bg-rose-950/30 text-zinc-500 hover:text-rose-400 rounded transition cursor-pointer"
                              title="Mark suggestion as Bad reply"
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
                              className="text-[10px] bg-emerald-600 text-white hover:bg-emerald-500 px-2.5 py-1 rounded-md font-semibold transition cursor-pointer"
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

            {/* Outgoing Message Entry (24 hours compliance checker) */}
            <div className="p-4 border-t border-zinc-900 bg-[#0c0c0e] relative">
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

              {isPast24Hours ? (
                <div className="bg-rose-950/20 border border-rose-900/40 border-l-4 border-l-rose-500 p-4 rounded-xl text-xs text-rose-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Lock className="h-4 w-4 shrink-0 text-rose-400" />
                    WhatsApp Customer Service Window Expired
                  </div>
                  <p className="leading-relaxed text-rose-300">
                    “Cannot send free-form reply. The 24-hour customer service window has expired. Template messages are not enabled in this version.”
                  </p>
                  {lastIncomingTime && (
                    <div className="text-[10px] text-rose-500 font-mono mt-1">
                      Last inbound message was: {lastIncomingTime.toLocaleString()}
                    </div>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage(replyText, "manual");
                  }}
                  className="flex gap-3 items-end"
                >
                  <div className="flex-1 bg-zinc-900 border border-zinc-850 rounded-xl px-4 py-2 flex items-center gap-3">
                    <textarea
                      rows={1}
                      placeholder="Type a manual candidate reply (type '/' for templates)..."
                      value={replyText}
                      onChange={(e) => handleTextareaChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 bg-transparent border-0 outline-none text-sm text-zinc-100 focus:ring-0 resize-none max-h-24 font-sans py-1 placeholder-zinc-500"
                    />
                    {quickReplies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickRepliesButtonMenu(!showQuickRepliesButtonMenu);
                          setShowQuickReplyMenu(false);
                        }}
                        className={`p-1.5 rounded-lg hover:bg-[#1a1a24] transition cursor-pointer shrink-0 ${
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
                    disabled={sendingReply || !replyText.trim()}
                    className="h-11 w-11 shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl flex items-center justify-center transition shadow-lg shadow-emerald-950/20 cursor-pointer"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              )}
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
                Recruitment Details
              </h5>

              <div className="space-y-3 text-xs">
                
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
