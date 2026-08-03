import React, { useState, useEffect } from "react";
import { 
  Settings2, Smartphone, Cpu, GitMerge, Users, Plus, Save, Trash2, 
  CheckCircle2, RefreshCw, Key, HelpCircle, Shield, AlertTriangle, Eye, EyeOff, MessageSquare
} from "lucide-react";
import { User, WhatsAppNumber, AISettings, AITrainingData, Workflow, WorkflowStep, QuickReply } from "../types.ts";

interface SettingsProps {
  token: string;
  currentUser: any;
}

type WorkflowFormState = {
  name: string;
  triggerKeyword: string;
  startMode: "keyword" | "default";
  isDefault: boolean;
  restartOnClosedMessage: boolean;
  welcomeMessage: string;
  isActive: boolean;
  steps: WorkflowStep[];
};

const createEmptyWorkflowForm = (): WorkflowFormState => ({
  name: "",
  triggerKeyword: "",
  startMode: "keyword",
  isDefault: false,
  restartOnClosedMessage: false,
  welcomeMessage: "",
  isActive: true,
  steps: [],
});

export default function Settings({ token, currentUser }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<"numbers" | "ai" | "workflows" | "users" | "quick_replies">("numbers");
  
  // 1. WhatsApp Numbers State
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<WhatsAppNumber | null>(null);
  const [numForm, setNumForm] = useState<Partial<WhatsAppNumber>>({
    displayName: "", phoneNumber: "", phoneNumberId: "", wabaId: "", 
    appId: "", appSecret: "", accessToken: "", verifyToken: "", isActive: true
  });
  const [showSecret, setShowSecret] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [loadingTest, setLoadingTest] = useState(false);
  const [testNumInput, setTestNumInput] = useState("");
  const [testReplyMessage, setTestReplyMessage] = useState("");
  const [sendingTestReply, setSendingTestReply] = useState(false);

  // Quick Replies State
  const [quickRepliesList, setQuickRepliesList] = useState<QuickReply[]>([]);
  const [newQuickReply, setNewQuickReply] = useState({ shortcut: "", message: "" });
  const [editingQuickReplyId, setEditingQuickReplyId] = useState<number | null>(null);
  const [editQuickReplyForm, setEditQuickReplyForm] = useState({ shortcut: "", message: "" });

  // Assignments State
  const [userList, setUserList] = useState<User[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [primaryOwnerId, setPrimaryOwnerId] = useState<number | null>(null);

  // 2. AI Settings State
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [trainingData, setTrainingData] = useState<AITrainingData[]>([]);
  const [newTraining, setNewTraining] = useState({ type: "faq", question: "", answer: "" });

  // 3. Workflows State
  const [workflowsList, setWorkflowsList] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [wfForm, setWfForm] = useState<WorkflowFormState>(createEmptyWorkflowForm());
  const [activeStepEdit, setActiveStepEdit] = useState<WorkflowStep | null>(null);

  // 4. User Management State (Super Admin Only)
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", password: "", role: "user" as any, isActive: true, canEditWorkflows: false });
  const [userEditId, setUserEditId] = useState<number | null>(null);

  // --- INITIALIZERS & DATA LOADERS ---

  const loadNumbers = async () => {
    try {
      const res = await fetch("/api/whatsapp_numbers", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNumbers(data);
        if (data.length > 0 && !selectedNumber) {
          handleSelectNumber(data[0]);
        }
      }
    } catch (e) { console.error(e); }
  };

  const loadUsers = async () => {
    try {
      if (currentUser.role === "super_admin") {
        const res = await fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUserList(data);
        }
      } else {
        setUserList([currentUser]);
      }
    } catch (e) { console.error(e); }
  };

  const handleSelectNumber = async (num: WhatsAppNumber) => {
    setSelectedNumber(num);
    // Secrets are intentionally write-only and are never returned by the API.
    setNumForm({
      ...num,
      appSecret: "",
      accessToken: "",
      verifyToken: "",
    });
    setConnectionMessage("");
    setTestReplyMessage("");
    
    // Load current assignments
    const assignedIds = (num as any).assignedUsers?.map((au: any) => au.userId) || [];
    setSelectedAssignees(assignedIds);
    const primary = (num as any).assignedUsers?.find((au: any) => au.isPrimary);
    setPrimaryOwnerId(primary ? primary.userId : null);

    // Load AI settings for this number
    try {
      const aiRes = await fetch(`/api/whatsapp_numbers/${num.id}/ai-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        setAiSettings(aiData);
      }

      // Load FAQ training data
      const tRes = await fetch(`/api/whatsapp_numbers/${num.id}/ai-training-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (tRes.ok) {
        const tData = await tRes.json();
        setTrainingData(tData);
      }

      // Load Workflows
      const wfRes = await fetch(`/api/whatsapp_numbers/${num.id}/workflows`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflowsList(wfData);
        if (wfData.length > 0) {
          handleSelectWorkflow(wfData[0]);
        } else {
          setSelectedWorkflow(null);
          setWfForm(createEmptyWorkflowForm());
        }
      }

      // Load Quick Replies
      const qrRes = await fetch(`/api/whatsapp_numbers/${num.id}/quick-replies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        setQuickRepliesList(qrData);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadNumbers();
    loadUsers();
  }, [token]);

  // --- WHATSAPP SETTINGS ACTIONS ---

  const handleSaveNumberSettings = async () => {
    if (!numForm.displayName || !numForm.phoneNumber) {
      alert("Please enter display name and phone number!");
      return;
    }
    try {
      const isNew = !numForm.id;
      const url = isNew ? "/api/whatsapp_numbers" : `/api/whatsapp_numbers/${numForm.id}`;
      const method = isNew ? "POST" : "PUT";

      const payload: Record<string, unknown> = { ...numForm };

      // For an existing number, blank secret fields mean "keep the saved value".
      if (!isNew) {
        if (!String(numForm.appSecret || "").trim()) delete payload.appSecret;
        if (!String(numForm.accessToken || "").trim()) delete payload.accessToken;
        if (!String(numForm.verifyToken || "").trim()) delete payload.verifyToken;
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Failed to save configuration.");
        return;
      }

      alert("WhatsApp Number API configuration saved successfully!");
      loadNumbers();
    } catch (e) { console.error(e); }
  };

  const handleSaveAssignments = async () => {
    if (!selectedNumber) return;
    try {
      const response = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userIds: selectedAssignees,
          primaryOwnerId
        })
      });
      if (response.ok) {
        alert("Assigned operators updated!");
        loadNumbers();
      }
    } catch (e) { console.error(e); }
  };

  const handleTestConnection = async () => {
    if (!selectedNumber) return;
    setLoadingTest(true);
    setConnectionMessage("");
    try {
      const res = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/test-connection`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({
        error: `Server returned ${res.status} ${res.statusText || "without a JSON response"}.`
      }));
      if (res.ok) {
        setConnectionMessage("SUCCESS: " + data.message);
        loadNumbers();
      } else {
        setConnectionMessage("FAILED: " + data.error);
      }
    } catch (e) {
      setConnectionMessage("Network verification failure. Check that the application service is running.");
    } finally {
      setLoadingTest(false);
    }
  };

  const handleSendTestReply = async () => {
    if (!selectedNumber) return;

    setTestReplyMessage("");
    const normalizedTestNumber = testNumInput.replace(/[^\d]/g, "");

    if (!numForm.isActive) {
      setTestReplyMessage("FAILED: Activate this WhatsApp receiving line and save the configuration first.");
      return;
    }
    const hasSavedAccessToken = Boolean(selectedNumber.hasAccessToken);
    const hasNewAccessToken = Boolean(String(numForm.accessToken || "").trim());
    if (!numForm.phoneNumberId || (!hasSavedAccessToken && !hasNewAccessToken)) {
      setTestReplyMessage("FAILED: Enter the Phone Number ID and Permanent Access Token, then save the configuration.");
      return;
    }
    if (normalizedTestNumber.length < 8 || normalizedTestNumber.length > 15) {
      setTestReplyMessage("FAILED: Enter the recipient in international format with country code, for example 94771234567.");
      return;
    }

    setSendingTestReply(true);
    try {
      const res = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/test-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ testNumber: normalizedTestNumber })
      });
      const data = await res.json().catch(() => ({
        error: `Server returned ${res.status} ${res.statusText || "without a JSON response"}.`
      }));
      setTestReplyMessage(
        res.ok
          ? `SUCCESS: ${data.message}`
          : `FAILED: ${data.error || `Request failed with HTTP ${res.status}.`}`
      );
    } catch (e) {
      setTestReplyMessage("FAILED: Could not reach the application server.");
    } finally {
      setSendingTestReply(false);
    }
  };

  // --- AI SETTINGS ACTIONS ---

  const handleSaveAISettings = async () => {
    if (!selectedNumber || !aiSettings) return;
    try {
      const res = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/ai-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(aiSettings)
      });
      if (res.ok) {
        alert("AI Settings and Knowledge Base stored!");
      }
    } catch (e) { console.error(e); }
  };

  const handleAddTrainingItem = async () => {
    if (!selectedNumber || !newTraining.question || !newTraining.answer) return;
    try {
      const res = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/ai-training-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newTraining)
      });
      if (res.ok) {
        const item = await res.json();
        setTrainingData(prev => [item, ...prev]);
        setNewTraining({ type: "faq", question: "", answer: "" });
        alert("Training rule added!");
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteTrainingItem = async (itemId: number) => {
    if (!selectedNumber) return;
    try {
      const res = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/ai-training-data/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setTrainingData(prev => prev.filter(i => i.id !== itemId));
      }
    } catch (e) { console.error(e); }
  };

  // --- QUICK REPLIES ACTIONS ---

  const handleAddQuickReply = async () => {
    if (!selectedNumber || !newQuickReply.shortcut || !newQuickReply.message) {
      alert("Please enter a shortcut and a message!");
      return;
    }
    try {
      const res = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/quick-replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newQuickReply)
      });
      if (res.ok) {
        const item = await res.json();
        setQuickRepliesList(prev => [item, ...prev]);
        setNewQuickReply({ shortcut: "", message: "" });
        alert("Quick reply template added successfully!");
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to add quick reply");
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveEditQuickReply = async (replyId: number) => {
    if (!selectedNumber || !editQuickReplyForm.shortcut || !editQuickReplyForm.message) {
      alert("Please enter a shortcut and a message!");
      return;
    }
    try {
      const res = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/quick-replies/${replyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editQuickReplyForm)
      });
      if (res.ok) {
        const updated = await res.json();
        setQuickRepliesList(prev => prev.map(item => item.id === replyId ? updated : item));
        setEditingQuickReplyId(null);
        setEditQuickReplyForm({ shortcut: "", message: "" });
        alert("Quick reply template updated!");
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to update quick reply");
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteQuickReply = async (replyId: number) => {
    if (!selectedNumber) return;
    if (!confirm("Are you sure you want to delete this quick reply?")) return;
    try {
      const res = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/quick-replies/${replyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setQuickRepliesList(prev => prev.filter(i => i.id !== replyId));
      } else {
        alert("Failed to delete quick reply");
      }
    } catch (e) { console.error(e); }
  };

  // --- WORKFLOW SETTINGS ACTIONS ---

  const handleSelectWorkflow = (wf: Workflow) => {
    setSelectedWorkflow(wf);
    setWfForm({
      name: wf.name,
      triggerKeyword: wf.triggerKeyword || "",
      startMode: wf.startMode || "keyword",
      isDefault: Boolean(wf.isDefault),
      restartOnClosedMessage: Boolean(wf.restartOnClosedMessage),
      welcomeMessage: wf.welcomeMessage,
      isActive: wf.isActive,
      steps: JSON.parse(wf.steps)
    });
    setActiveStepEdit(null);
  };

  const handleSaveWorkflow = async () => {
    if (!selectedNumber || !wfForm.name.trim() || !wfForm.welcomeMessage.trim()) {
      alert("Workflow name and welcome message are required.");
      return;
    }
    if (wfForm.startMode === "keyword" && !wfForm.triggerKeyword.trim()) {
      alert("A trigger keyword is required for an exact-keyword workflow.");
      return;
    }
    if (wfForm.steps.length === 0) {
      alert("Add at least one workflow step before saving.");
      return;
    }
    try {
      const isNew = !selectedWorkflow;
      const url = isNew 
        ? `/api/whatsapp_numbers/${selectedNumber.id}/workflows`
        : `/api/whatsapp_numbers/${selectedNumber.id}/workflows/${selectedWorkflow.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(wfForm)
      });

      if (res.ok) {
        alert("Workflow saved successfully!");
        // Refresh workflows list
        const listRes = await fetch(`/api/whatsapp_numbers/${selectedNumber.id}/workflows`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          setWorkflowsList(listData);
          if (listData.length > 0) {
            handleSelectWorkflow(listData[0]);
          }
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleAddStepToWf = () => {
    const newStep: WorkflowStep = {
      id: "step_" + Date.now(),
      type: "question",
      questionText: "New Step Question Text?",
      variableName: "notes"
    };
    setWfForm(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
    setActiveStepEdit(newStep);
  };

  const handleSaveStepInWf = (updatedStep: WorkflowStep) => {
    setWfForm(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === updatedStep.id ? updatedStep : s)
    }));
    setActiveStepEdit(null);
    alert("Step updated in local builder. Remember to click Save Workflow below!");
  };

  const handleDeleteStepFromWf = (stepId: string) => {
    setWfForm(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId)
    }));
    if (activeStepEdit?.id === stepId) setActiveStepEdit(null);
  };

  // --- USER MANAGEMENT ACTIONS ---

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      alert("Missing name, email, or password.");
      return;
    }
    try {
      const method = userEditId ? "PUT" : "POST";
      const url = userEditId ? `/api/users/${userEditId}` : "/api/users";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newUserForm)
      });
      const data = await res.json();
      if (res.ok) {
        alert(userEditId ? "User details modified!" : "New operator registered!");
        setNewUserForm({ name: "", email: "", password: "", role: "user", isActive: true, canEditWorkflows: false });
        setUserEditId(null);
        loadUsers();
      } else {
        alert(data.error);
      }
    } catch (e) { console.error(e); }
  };

  const handleEditUserClick = (u: User) => {
    setUserEditId(u.id);
    setNewUserForm({
      name: u.name,
      email: u.email,
      password: "", // leave empty to not change
      role: u.role,
      isActive: u.isActive,
      canEditWorkflows: u.canEditWorkflows
    });
  };

  const handleDeleteUser = async (uId: number) => {
    if (uId === currentUser.id) {
      alert("You cannot delete your own logged-in account.");
      return;
    }
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/users/${uId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("User deleted from Cloud SQL.");
        loadUsers();
      }
    } catch (e) { console.error(e); }
  };

  const handleToggleActiveNumber = () => {
    setNumForm(prev => ({ ...prev, isActive: !prev.isActive }));
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 font-sans">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Configuration Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Securely manage Meta credentials, AI parameters, candidate workflow trees, and team assignments.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Navigation / Selected Number Sidebar */}
        <div className="bg-[#0c0c0e] rounded-2xl p-4 border border-zinc-800 space-y-4">
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Select Line</span>
            <div className="mt-2 space-y-2">
              {numbers.map((num) => (
                <button
                  key={num.id}
                  onClick={() => handleSelectNumber(num)}
                  className={`w-full text-left p-3 rounded-xl transition flex flex-col cursor-pointer text-xs ${
                    selectedNumber?.id === num.id
                      ? "bg-emerald-950/40 border border-emerald-800 text-emerald-400 font-semibold"
                      : "bg-[#09090b] border border-zinc-850 text-zinc-350 hover:bg-zinc-900"
                  }`}
                >
                  <span className="truncate">{num.displayName}</span>
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{num.phoneNumber}</span>
                </button>
              ))}
              {currentUser.role === "super_admin" && (
                <button
                  onClick={() => {
                    setSelectedNumber(null);
                    setNumForm({ displayName: "", phoneNumber: "", phoneNumberId: "", wabaId: "", appId: "", appSecret: "", accessToken: "", verifyToken: "", isActive: true });
                  }}
                  className="w-full py-2 border border-dashed border-zinc-750 rounded-xl hover:bg-zinc-900/60 text-zinc-400 flex items-center justify-center gap-1.5 text-xs transition cursor-pointer font-semibold"
                >
                  <Plus className="h-4 w-4" /> Add WhatsApp Line
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Control Panels</span>
            <div className="mt-2 flex flex-col gap-1.5">
              {[
                { id: "numbers", label: "WhatsApp Meta API", icon: Smartphone },
                { id: "ai", label: "AI Suggestions & KB", icon: Cpu },
                { id: "workflows", label: "Workflows Onboarding", icon: GitMerge },
                { id: "quick_replies", label: "Quick Replies / Templates", icon: MessageSquare },
                { id: "users", label: "User Management", icon: Users }
              ].map((panel) => {
                const Icon = panel.icon;
                if (panel.id === "users" && currentUser.role !== "super_admin") return null;
                return (
                  <button
                    key={panel.id}
                    onClick={() => setActiveTab(panel.id as any)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-center gap-2.5 text-xs cursor-pointer ${
                      activeTab === panel.id
                        ? "bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/20"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {panel.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Configurations Forms Container */}
        <div className="lg:col-span-3 bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-6 min-h-[500px]">
          
          {/* TAB 1: WhatsApp Numbers settings */}
          {activeTab === "numbers" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-zinc-150 text-base">Meta WhatsApp Cloud API Connection</h3>
                {selectedNumber && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    selectedNumber.webhookStatus === "Verified" 
                      ? "bg-emerald-950/55 text-emerald-400 border border-emerald-900/40" 
                      : "bg-amber-950/55 text-amber-400 border border-amber-900/40"
                  }`}>
                    {selectedNumber.webhookStatus}
                  </span>
                )}
              </div>

              {currentUser.role === "user" ? (
                <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 flex gap-2 text-xs text-zinc-400">
                  <Shield className="h-5 w-5 text-zinc-500 shrink-0" />
                  <p>You have reading view permission to this number's configuration. Secret tokens are hidden from non-admin operators.</p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Display Name</label>
                  <input
                    type="text"
                    disabled={currentUser.role === "user"}
                    value={numForm.displayName || ""}
                    onChange={(e) => setNumForm({ ...numForm, displayName: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-50"
                    placeholder="e.g. InTalent Careers"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Business Phone Number</label>
                  <input
                    type="text"
                    disabled={currentUser.role === "user"}
                    value={numForm.phoneNumber || ""}
                    onChange={(e) => setNumForm({ ...numForm, phoneNumber: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-50"
                    placeholder="e.g. +447123456789"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    disabled={currentUser.role === "user"}
                    value={numForm.phoneNumberId || ""}
                    onChange={(e) => setNumForm({ ...numForm, phoneNumberId: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-50 font-mono"
                    placeholder="e.g. 109283749281739"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">WABA (WhatsApp Business Account) ID</label>
                  <input
                    type="text"
                    disabled={currentUser.role === "user"}
                    value={numForm.wabaId || ""}
                    onChange={(e) => setNumForm({ ...numForm, wabaId: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-50 font-mono"
                    placeholder="e.g. 987654321098765"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Meta App ID</label>
                  <input
                    type="text"
                    disabled={currentUser.role === "user"}
                    value={numForm.appId || ""}
                    onChange={(e) => setNumForm({ ...numForm, appId: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-50 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-400 block">Meta App Secret</label>
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-350 flex items-center gap-1 font-semibold"
                    >
                      {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showSecret ? "Hide new values" : "Show new values"}
                    </button>
                  </div>
                  <input
                    type={showSecret ? "text" : "password"}
                    disabled={currentUser.role === "user"}
                    value={numForm.appSecret || ""}
                    onChange={(e) => setNumForm({ ...numForm, appSecret: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-50 font-mono"
                    placeholder={selectedNumber?.hasAppSecret ? "Saved securely — enter only to replace" : "Enter Meta App Secret"}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Permanent Access Token</label>
                  <input
                    type={showSecret ? "text" : "password"}
                    disabled={currentUser.role === "user"}
                    value={numForm.accessToken || ""}
                    onChange={(e) => setNumForm({ ...numForm, accessToken: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-50 font-mono"
                    placeholder={selectedNumber?.hasAccessToken ? "Saved securely — enter only to replace" : "Enter Permanent Access Token"}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Webhook Verify Token (Your Custom Secret)</label>
                  <input
                    type={showSecret ? "text" : "password"}
                    disabled={currentUser.role === "user"}
                    value={numForm.verifyToken || ""}
                    onChange={(e) => setNumForm({ ...numForm, verifyToken: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:opacity-50 font-mono"
                    placeholder={selectedNumber?.hasVerifyToken ? "Saved securely — enter only to replace" : "Enter Webhook Verify Token"}
                  />
                </div>

                {selectedNumber && (
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">Calculated Callback URL</label>
                    <div className="w-full border border-zinc-800 bg-[#09090b] rounded-xl p-2.5 text-[10px] text-zinc-400 select-all font-mono break-all leading-normal">
                      {window.location.origin}/webhooks/whatsapp/{selectedNumber.id}
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle number active */}
              {currentUser.role !== "user" && (
                <div className="flex items-center gap-3 bg-[#09090b] p-4 rounded-xl border border-zinc-800">
                  <input
                    type="checkbox"
                    id="isActiveNum"
                    checked={numForm.isActive || false}
                    onChange={handleToggleActiveNumber}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4.5 w-4.5 accent-emerald-600"
                  />
                  <label htmlFor="isActiveNum" className="text-xs font-semibold text-zinc-350 cursor-pointer">
                    WhatsApp receiving line active
                  </label>
                </div>
              )}

              {/* Actions Footer */}
              {currentUser.role !== "user" && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={loadingTest || !selectedNumber}
                      className="text-xs bg-zinc-900 text-zinc-300 border border-zinc-850 hover:bg-zinc-800 px-4 py-2 rounded-xl font-semibold transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {loadingTest ? "Testing..." : "Verify Connection"}
                      <RefreshCw className={`h-3 w-3 ${loadingTest ? 'animate-spin' : ''}`} />
                    </button>
                    
                    {selectedNumber && (
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          placeholder="Meta Test Number"
                          value={testNumInput}
                          onChange={(e) => {
                            setTestNumInput(e.target.value);
                            setTestReplyMessage("");
                          }}
                          className="border border-zinc-800 bg-[#09090b] text-zinc-150 p-2 rounded-xl text-xs font-mono max-w-[130px] outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleSendTestReply}
                          disabled={sendingTestReply}
                          className="text-xs bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-850/60 px-3 py-2 rounded-xl font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          {sendingTestReply ? "Sending..." : "Send Test Text"}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveNumberSettings}
                    className="text-xs bg-emerald-600 text-white hover:bg-emerald-500 px-5 py-2.5 rounded-xl font-semibold transition flex items-center gap-2 shadow shadow-emerald-950/10 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    Save Configuration
                  </button>
                </div>
              )}

              {connectionMessage && (
                <div className={`p-4 rounded-xl text-xs font-mono border ${
                  connectionMessage.startsWith("SUCCESS") 
                    ? "bg-emerald-950/45 text-emerald-300 border-emerald-900/50" 
                    : "bg-rose-950/45 text-rose-300 border-rose-900/50"
                }`}>
                  {connectionMessage}
                </div>
              )}

              {testReplyMessage && (
                <div className={`p-4 rounded-xl text-xs font-mono border ${
                  testReplyMessage.startsWith("SUCCESS")
                    ? "bg-emerald-950/45 text-emerald-300 border-emerald-900/50"
                    : "bg-rose-950/45 text-rose-300 border-rose-900/50"
                }`}>
                  {testReplyMessage}
                </div>
              )}

              {/* Operator Assignments Section (Admin/Super Admin only) */}
              {selectedNumber && currentUser.role !== "user" && (
                <div className="border-t border-zinc-800 pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-zinc-200 text-sm">Operator & Number Assignments</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Assign recruiters to manage candidate chats coming to this number.</p>
                    </div>
                    <button
                      onClick={handleSaveAssignments}
                      className="text-xs bg-zinc-900 text-zinc-300 border border-zinc-850 hover:bg-zinc-850 px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer"
                    >
                      Update Assignments
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Operator Checkboxes */}
                    <div className="border border-zinc-800 bg-[#09090b] p-4 rounded-xl max-h-52 overflow-y-auto space-y-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Operators with Access</span>
                      {userList.map(u => (
                        <label key={u.id} className="flex items-center gap-2.5 text-xs text-zinc-350 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAssignees.includes(u.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAssignees(prev => [...prev, u.id]);
                              } else {
                                setSelectedAssignees(prev => prev.filter(id => id !== u.id));
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 accent-emerald-600"
                          />
                          <div>
                            <span className="font-semibold block">{u.name}</span>
                            <span className="text-[10px] text-zinc-500">{u.role} - {u.email}</span>
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* Primary Owner Selector */}
                    <div className="border border-zinc-800 bg-[#09090b] p-4 rounded-xl space-y-2 text-xs">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Primary Line Owner</span>
                      <p className="text-zinc-400 text-[11px] leading-relaxed mb-3">
                        The primary owner is the recruiter responsible for audit logging and template approvals.
                      </p>
                      <select
                        value={primaryOwnerId || ""}
                        onChange={(e) => setPrimaryOwnerId(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full border border-zinc-800 rounded-xl p-2 bg-[#0c0c0e] text-xs text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      >
                        <option value="">No Primary Owner</option>
                        {userList.filter(u => selectedAssignees.includes(u.id)).map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI Settings and training */}
          {activeTab === "ai" && selectedNumber && aiSettings && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="font-bold text-zinc-150 text-base">Gemini AI Assistant & Knowledge Base</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Line settings for {selectedNumber.displayName}</p>
                </div>
              </div>

              {/* Grounded provider status */}
              <div className={`rounded-xl p-4 flex gap-3 text-xs border ${
                aiSettings.apiConfigured
                  ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400"
                  : "bg-amber-950/25 border-amber-900/60 text-amber-300"
              }`}>
                <Shield className={`h-5 w-5 shrink-0 ${aiSettings.apiConfigured ? "text-emerald-500" : "text-amber-400"}`} />
                <div className="space-y-1">
                  <span className="font-bold block">
                    {aiSettings.apiConfigured ? "Gemini Connected — Grounded Mode" : "Gemini API Key Not Connected"}
                  </span>
                  <p className="leading-relaxed">
                    Suggestions use only the saved Company Knowledge Base, approved FAQ/rules, approved reply examples, contact profile, and conversation context. If approved knowledge or Gemini is unavailable, the Inbox shows an error instead of a demo reply.
                  </p>
                </div>
              </div>

              {/* Toggles & tone select */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Tone select */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Tone of Voice</label>
                  <select
                    value={aiSettings.defaultTone}
                    onChange={(e) => setAiSettings({ ...aiSettings, defaultTone: e.target.value as any })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="professional">Professional / Executive Recruiter</option>
                    <option value="friendly">Friendly / Warm Counselor</option>
                    <option value="casual">Casual / Direct Associate</option>
                    <option value="helpful">Helpful / Assistant Agent</option>
                  </select>
                </div>

                {/* Restricted words */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Restricted Words (Comma separated)</label>
                  <input
                    type="text"
                    value={aiSettings.restrictedWords || ""}
                    onChange={(e) => setAiSettings({ ...aiSettings, restrictedWords: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-2.5 bg-[#09090b] text-xs text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. guarantee, 100%, secure, bypass"
                  />
                </div>

                {/* Toggles row */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#09090b] p-4 rounded-xl border border-zinc-800">
                  <label className="flex items-center gap-2.5 text-xs text-zinc-350 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiSettings.autoSuggest}
                      onChange={(e) => setAiSettings({ ...aiSettings, autoSuggest: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 accent-emerald-600"
                    />
                    Generate Chat Suggestions
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-zinc-350 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiSettings.autoReply}
                      onChange={(e) => setAiSettings({ ...aiSettings, autoReply: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 accent-emerald-600"
                    />
                    Auto-Reply to WhatsApp (No click)
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-zinc-350 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiSettings.humanApprovalRequired}
                      onChange={(e) => setAiSettings({ ...aiSettings, humanApprovalRequired: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 accent-emerald-600"
                    />
                    Force Human Approval
                  </label>
                </div>

                <div className="md:col-span-2">
                  {!aiSettings.autoReply ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-[11px] text-zinc-400">
                      Auto-reply is OFF. Recruiters can review grounded suggestions before sending. Direct requests for a recruiter still create a human handover.
                    </div>
                  ) : aiSettings.humanApprovalRequired ? (
                    <div className="rounded-xl border border-amber-900/60 bg-amber-950/25 px-4 py-3 text-[11px] text-amber-300">
                      Auto-reply is selected but blocked by Force Human Approval. No Gemini reply will be sent automatically.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-rose-900/60 bg-rose-950/25 px-4 py-3 text-[11px] text-rose-300">
                      LIVE AUTO-REPLY ENABLED: only verified grounded replies above the confidence threshold may be sent. Workflows and human handover always have priority.
                    </div>
                  )}
                </div>

                {/* Knowledge Base */}
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Approved Company Knowledge Base</label>
                  <textarea
                    rows={4}
                    value={aiSettings.companyKnowledgeBase}
                    onChange={(e) => setAiSettings({ ...aiSettings, companyKnowledgeBase: e.target.value })}
                    className="w-full border border-zinc-800 rounded-xl p-3 bg-[#09090b] text-xs text-zinc-100 leading-relaxed focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    placeholder="Add only confirmed company facts, official links, contact details, application instructions, and approved policies. Do not add guesses or temporary information."
                  />
                </div>
              </div>

              {/* Save settings CTA */}
              <div className="flex justify-end pt-2 border-b border-zinc-800 pb-5">
                <button
                  type="button"
                  onClick={handleSaveAISettings}
                  className="text-xs bg-emerald-600 text-white hover:bg-emerald-500 px-5 py-2.5 rounded-xl font-semibold transition flex items-center gap-2 shadow shadow-emerald-950/10 cursor-pointer"
                >
                  <Save className="h-4 w-4" /> Save AI Profile
                </button>
              </div>

              {/* FAQ & Training database */}
              <div className="space-y-4 pt-2">
                <div>
                  <h4 className="font-bold text-zinc-200 text-sm">Approved AI Knowledge & Feedback</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">FAQ, rules, and approved replies can ground future suggestions. Rejected replies are stored as feedback and are excluded from trusted knowledge.</p>
                </div>

                {/* Add Training FAQ form */}
                <div className="bg-[#09090b] p-4 rounded-xl border border-zinc-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
                  <div>
                    <label className="text-zinc-400 block mb-1 font-semibold">Rule/Item Type</label>
                    <select
                      value={newTraining.type}
                      onChange={(e) => setNewTraining({ ...newTraining, type: e.target.value })}
                      className="w-full border border-zinc-800 rounded-lg p-2 bg-[#0c0c0e] text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                      <option value="faq">FAQ Answer</option>
                      <option value="rule">Company Rule</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <div>
                      <span className="text-zinc-400 block mb-1 font-semibold">Question / Rule Trigger Context</span>
                      <input
                        type="text"
                        value={newTraining.question}
                        onChange={(e) => setNewTraining({ ...newTraining, question: e.target.value })}
                        placeholder="e.g. Where can a candidate submit a CV?"
                        className="w-full border border-zinc-800 rounded-lg p-2 bg-[#0c0c0e] text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-zinc-400 block mb-1 font-semibold">Approved AI Reply / Instruction</span>
                      <input
                        type="text"
                        value={newTraining.answer}
                        onChange={(e) => setNewTraining({ ...newTraining, answer: e.target.value })}
                        placeholder="e.g. Please email your CV to cv@intalent.asia and mention the job title in the subject line."
                        className="w-full border border-zinc-800 rounded-lg p-2 bg-[#0c0c0e] text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddTrainingItem}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition text-xs cursor-pointer"
                  >
                    Add Approved Item
                  </button>
                </div>

                {/* Training rules list */}
                <div className="divide-y divide-zinc-800 max-h-64 overflow-y-auto border border-zinc-800 rounded-xl p-3 bg-[#09090b]">
                  {trainingData.length === 0 ? (
                    <div className="text-center py-6 text-xs text-zinc-500">No approved FAQ or rules added yet. Add confirmed information above before generating suggestions.</div>
                  ) : (
                    trainingData.map((item) => (
                      <div key={item.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                        <div>
                          <div className="flex gap-2 items-center">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                              item.type === 'faq' 
                                ? 'bg-[#1e1b4b] text-indigo-400 border border-indigo-900/40' 
                                : 'bg-[#451a03] text-amber-400 border border-amber-900/40'
                            }`}>{item.type}</span>
                            <span className="font-semibold text-zinc-250">Trigger: {item.question}</span>
                          </div>
                          <p className="text-zinc-400 mt-1 italic">“{item.answer}”</p>
                        </div>
                        <button
                          onClick={() => handleDeleteTrainingItem(item.id)}
                          className="p-1.5 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 rounded transition shrink-0 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: Onboarding Workflows builder */}
          {activeTab === "workflows" && selectedNumber && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="font-bold text-zinc-150 text-base">Candidate Onboarding Workflow Tree</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Configure step-by-step automated forms for {selectedNumber.displayName}</p>
                </div>
              </div>

              {/* Sidebar list + builder layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Active Workflows list column */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Created Onboarding Workflows</span>
                  <div className="space-y-2">
                    {workflowsList.map(wf => (
                      <button
                        key={wf.id}
                        onClick={() => handleSelectWorkflow(wf)}
                        className={`w-full text-left p-3 rounded-xl border text-xs transition flex flex-col cursor-pointer ${
                          selectedWorkflow?.id === wf.id
                            ? "bg-emerald-950/40 border border-emerald-800 text-emerald-400 font-semibold"
                            : "bg-[#09090b] border border-zinc-850 text-zinc-350 hover:bg-zinc-900"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {wf.name}
                          {wf.isDefault && (
                            <span className="rounded-full border border-emerald-800 bg-emerald-950/50 px-2 py-0.5 text-[9px] uppercase tracking-wider text-emerald-400">
                              Default
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-zinc-500 mt-1">
                          {wf.startMode === "default"
                            ? (wf.restartOnClosedMessage
                              ? "Catch-all: first message + closed chat reopen"
                              : "Catch-all: contact's first message")
                            : `Keyword: "${wf.triggerKeyword}"`}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setSelectedWorkflow(null);
                        setWfForm({ ...createEmptyWorkflowForm(), name: "New Workflow Builder", triggerKeyword: "apply", welcomeMessage: "Welcome!" });
                        setActiveStepEdit(null);
                      }}
                      className="w-full py-2.5 border border-dashed border-zinc-750 text-zinc-400 rounded-xl flex items-center justify-center gap-1.5 text-xs transition hover:bg-zinc-900/60 cursor-pointer font-semibold"
                    >
                      <Plus className="h-4 w-4" /> Create New Workflow
                    </button>
                  </div>
                </div>

                {/* Workflow Builder central form column */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-[#09090b] p-4 border border-zinc-800 rounded-xl space-y-3.5 text-xs">
                    <div>
                      <label className="text-zinc-400 block mb-1 font-semibold">Workflow Name</label>
                      <input
                        type="text"
                        value={wfForm.name}
                        onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })}
                        placeholder="e.g. Candidate Registration"
                        className="w-full border border-zinc-850 rounded-lg p-2 bg-[#0c0c0e] text-zinc-100 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="text-zinc-400 block mb-1 font-semibold">Workflow Start Rule</label>
                      <select
                        value={wfForm.startMode === "keyword"
                          ? "keyword"
                          : (wfForm.restartOnClosedMessage ? "default_reopened" : "default_first")}
                        onChange={(e) => {
                          const selectedRule = e.target.value;
                          const isCatchAll = selectedRule !== "keyword";
                          setWfForm({
                            ...wfForm,
                            startMode: isCatchAll ? "default" : "keyword",
                            isDefault: isCatchAll,
                            restartOnClosedMessage: selectedRule === "default_reopened",
                          });
                        }}
                        className="w-full border border-zinc-850 rounded-lg p-2 bg-[#0c0c0e] text-zinc-100 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      >
                        <option value="keyword">Exact keyword only</option>
                        <option value="default_first">Any contact's first message</option>
                        <option value="default_reopened">First message + new message after chat is closed</option>
                      </select>
                      <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
                        Catch-all rules do not require the customer to type a keyword. Only one default workflow can be active for each WhatsApp number.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-zinc-400 block mb-1 font-semibold">
                          {wfForm.startMode === "keyword" ? "Trigger Keyword" : "Optional Menu Restart Keyword"}
                        </label>
                        <input
                          type="text"
                          value={wfForm.triggerKeyword}
                          onChange={(e) => setWfForm({ ...wfForm, triggerKeyword: e.target.value })}
                          placeholder={wfForm.startMode === "keyword" ? "e.g. jobs" : "e.g. menu (optional)"}
                          className="w-full border border-zinc-850 rounded-lg p-2 bg-[#0c0c0e] text-zinc-100 text-xs font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div className="flex items-center pt-5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-350 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wfForm.isActive}
                            onChange={(e) => setWfForm({ ...wfForm, isActive: e.target.checked })}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 accent-emerald-600"
                          />
                          Active Workflow
                        </label>
                      </div>
                    </div>

                    {wfForm.startMode === "default" && (
                      <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[10px] leading-relaxed text-amber-300">
                        This workflow becomes the default welcome flow for {selectedNumber.displayName}. Existing active workflow sessions and recruiter handovers will not be interrupted.
                      </div>
                    )}

                    <div>
                      <label className="text-zinc-400 block mb-1 font-semibold">Workflow Welcome Header</label>
                      <textarea
                        rows={2}
                        value={wfForm.welcomeMessage}
                        onChange={(e) => setWfForm({ ...wfForm, welcomeMessage: e.target.value })}
                        placeholder="e.g. Thank you for contacting InTalent Careers!"
                        className="w-full border border-zinc-850 rounded-lg p-2 bg-[#0c0c0e] text-zinc-100 text-xs leading-normal focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Steps Tree list */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Numbered Step Tree</span>
                      <button
                        onClick={handleAddStepToWf}
                        className="text-xs text-emerald-400 hover:text-emerald-350 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Step
                      </button>
                    </div>

                    <div className="space-y-2">
                      {wfForm.steps.map((step, idx) => (
                        <div
                          key={step.id}
                          className="bg-[#09090b] border border-zinc-800 p-3 rounded-xl flex items-center justify-between text-xs hover:border-zinc-700 transition"
                        >
                          <div>
                            <span className="font-bold text-emerald-400 mr-2">#{idx+1}</span>
                            <span className="font-semibold text-zinc-300 capitalize">[{step.type}]</span>
                            <p className="text-zinc-500 mt-0.5 max-w-sm truncate">{step.questionText}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => setActiveStepEdit(step)}
                              className="text-xs text-emerald-400 hover:text-emerald-350 font-semibold cursor-pointer"
                            >
                              Edit Step
                            </button>
                            <button
                              onClick={() => handleDeleteStepFromWf(step.id)}
                              className="text-xs text-rose-400 hover:text-rose-350 font-semibold cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Step Editor modal block if active */}
                    {activeStepEdit && (
                      <div className="bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-xl text-xs space-y-4">
                        <h4 className="font-bold text-emerald-400 border-b border-emerald-900/40 pb-1.5 uppercase tracking-wider text-[10px]">
                          Configure Step Properties
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-zinc-400 block mb-1">Step Answer Type</span>
                            <select
                              value={activeStepEdit.type}
                              onChange={(e) => setActiveStepEdit({ ...activeStepEdit, type: e.target.value as any })}
                              className="w-full border border-zinc-800 bg-[#09090b] text-zinc-200 p-2 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                            >
                              <option value="question">Question (Capture Text)</option>
                              <option value="menu">Option Menu (1, 2, 3 selection)</option>
                              <option value="handover">Transfer to Recruiter</option>
                              <option value="end_workflow">End Workflow Terminate</option>
                            </select>
                          </div>

                          <div>
                            <span className="text-zinc-400 block mb-1">Map variable to Candidate Profile</span>
                            <select
                              value={activeStepEdit.variableName || ""}
                              onChange={(e) => setActiveStepEdit({ ...activeStepEdit, variableName: e.target.value as any })}
                              className="w-full border border-zinc-800 bg-[#09090b] text-zinc-200 p-2 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                            >
                              <option value="">None (Don't save)</option>
                              <option value="name">Name</option>
                              <option value="cvField">CV / LinkedIn Link</option>
                              <option value="interestedJobRole">Desired Role</option>
                              <option value="expectedSalary">Expected Salary</option>
                              <option value="location">Candidate Location</option>
                              <option value="experience">Years Experience</option>
                              <option value="clientCandidateType">Client/Candidate Type</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <span className="text-zinc-400 block mb-1">Question / Statement Text</span>
                          <textarea
                            rows={2}
                            value={activeStepEdit.questionText}
                            onChange={(e) => setActiveStepEdit({ ...activeStepEdit, questionText: e.target.value })}
                            className="w-full border border-zinc-800 bg-[#09090b] text-zinc-100 p-2 rounded-lg leading-normal focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </div>

                        <div className="flex justify-end gap-2.5">
                          <button
                            onClick={() => setActiveStepEdit(null)}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg font-semibold hover:bg-zinc-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveStepInWf(activeStepEdit)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-semibold transition shadow-xs cursor-pointer"
                          >
                            Update Local Step
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Save Workflow Button */}
                  <div className="flex justify-end pt-2 border-t border-zinc-800">
                    <button
                      onClick={handleSaveWorkflow}
                      className="text-xs bg-emerald-600 text-white hover:bg-emerald-500 px-5 py-2.5 rounded-xl font-semibold transition flex items-center gap-2 shadow shadow-emerald-950/10 cursor-pointer"
                    >
                      <Save className="h-4 w-4" /> Save Workflow Tree
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: User operator management (Super Admin Only) */}
          {activeTab === "users" && currentUser.role === "super_admin" && (
            <div className="space-y-6 font-sans">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-zinc-150 text-base">User Operators (Security & Access Roles)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* User Register/Edit Form */}
                <form onSubmit={handleCreateUser} className="space-y-4 bg-[#09090b] p-4 border border-zinc-800 rounded-xl text-xs">
                  <h4 className="font-bold text-zinc-200 text-sm">{userEditId ? "Modify Operator Details" : "Register New Operator"}</h4>
                  
                  <div>
                    <span className="text-zinc-400 block mb-1">Full Name</span>
                    <input
                      type="text"
                      required
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                      placeholder="e.g. Sarah Connor"
                      className="w-full border border-zinc-850 rounded-lg p-2 bg-[#0c0c0e] text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-zinc-400 block mb-1">Email Address</span>
                    <input
                      type="email"
                      required
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      placeholder="e.g. sarah@intalent.co"
                      className="w-full border border-zinc-850 rounded-lg p-2 bg-[#0c0c0e] text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-zinc-400 block mb-1">{userEditId ? "Reset Password (Optional)" : "Password"}</span>
                    <input
                      type="password"
                      required={!userEditId}
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      className="w-full border border-zinc-850 rounded-lg p-2 bg-[#0c0c0e] text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <span className="text-zinc-400 block mb-1">Security Role</span>
                    <select
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                      className="w-full border border-zinc-850 rounded-lg p-2 bg-[#0c0c0e] text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                      <option value="user">User (Assigned lines only, manual/AI suggestions)</option>
                      <option value="admin">Admin (Workflows, reports, assignments)</option>
                      <option value="super_admin">Super Admin (Full root clearance)</option>
                    </select>
                  </div>

                  <div className="space-y-2 border-t border-zinc-800 pt-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-350 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUserForm.isActive}
                        onChange={(e) => setNewUserForm({ ...newUserForm, isActive: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 accent-emerald-600"
                      />
                      Active (Login Allowed)
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-350 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUserForm.canEditWorkflows}
                        onChange={(e) => setNewUserForm({ ...newUserForm, canEditWorkflows: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 accent-emerald-600"
                      />
                      Permit Onboarding Workflow Modification
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1.5">
                    {userEditId && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserEditId(null);
                          setNewUserForm({ name: "", email: "", password: "", role: "user", isActive: true, canEditWorkflows: false });
                        }}
                        className="flex-1 py-2 bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 font-semibold rounded-lg text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition cursor-pointer"
                    >
                      {userEditId ? "Save Edits" : "Register Operator"}
                    </button>
                  </div>
                </form>

                {/* Users List Column */}
                <div className="md:col-span-2 space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Registered Operators ({userList.length})</span>
                  <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl p-3 bg-[#09090b]">
                    {userList.map((u) => (
                      <div key={u.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-200">{u.name}</span>
                            <span className="text-[9px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase">{u.role}</span>
                            {!u.isActive && <span className="text-[9px] font-bold bg-rose-950/45 text-rose-300 border border-rose-900/50 px-2 py-0.5 rounded">Suspended</span>}
                          </div>
                          <p className="text-zinc-500 mt-0.5">{u.email}</p>
                          <div className="flex gap-2 text-[10px] text-zinc-500 mt-1">
                            <span>Workflows: {u.canEditWorkflows ? "Can Edit" : "ReadOnly"}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleEditUserClick(u)}
                            className="text-xs text-emerald-400 hover:text-emerald-350 font-semibold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-xs text-rose-400 hover:text-rose-350 font-semibold cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 5: Quick Replies Management */}
          {activeTab === "quick_replies" && (
            <div className="space-y-6 font-sans">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="font-bold text-zinc-150 text-base">Quick Replies & Templates</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Define common canned responses that operators can quickly insert into the message box in the Inbox.
                  </p>
                </div>
              </div>

              {!selectedNumber ? (
                <div className="bg-[#09090b] border border-dashed border-zinc-800 rounded-2xl p-8 text-center space-y-2">
                  <div className="h-10 w-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mx-auto text-zinc-400">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-zinc-200 text-sm">No WhatsApp Line Selected</h4>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-normal">
                    Quick replies are managed per WhatsApp line. Please choose a connection from the left sidebar to start.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Create / Edit Form */}
                  <div className="space-y-4 bg-[#09090b] p-4 border border-zinc-800 rounded-xl text-xs h-fit">
                    <h4 className="font-bold text-zinc-200 text-sm">
                      {editingQuickReplyId ? "Edit Quick Reply" : "New Quick Reply Template"}
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <span className="text-zinc-400 block mb-1">Shortcut (e.g. greeting or price)</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-zinc-500 font-mono text-xs">/</span>
                          <input
                            type="text"
                            placeholder="greeting"
                            value={editingQuickReplyId ? editQuickReplyForm.shortcut : newQuickReply.shortcut}
                            onChange={(e) => {
                              const cleanVal = e.target.value.replace(/^\//, ""); // auto-strip leading slash
                              if (editingQuickReplyId) {
                                setEditQuickReplyForm({ ...editQuickReplyForm, shortcut: cleanVal });
                              } else {
                                setNewQuickReply({ ...newQuickReply, shortcut: cleanVal });
                              }
                            }}
                            className="w-full pl-6 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-emerald-600 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-zinc-400 block mb-1">Message Text (Canned Response)</span>
                        <textarea
                          rows={6}
                          placeholder="Hello! Thank you for contacting us. How can we assist you today?"
                          value={editingQuickReplyId ? editQuickReplyForm.message : newQuickReply.message}
                          onChange={(e) => {
                            if (editingQuickReplyId) {
                              setEditQuickReplyForm({ ...editQuickReplyForm, message: e.target.value });
                            } else {
                              setNewQuickReply({ ...newQuickReply, message: e.target.value });
                            }
                          }}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-emerald-600 leading-normal"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        {editingQuickReplyId ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEditQuickReply(editingQuickReplyId)}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer text-center"
                            >
                              Save Changes
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuickReplyId(null);
                                setEditQuickReplyForm({ shortcut: "", message: "" });
                              }}
                              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition cursor-pointer text-center font-medium"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleAddQuickReply}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" /> Save Template
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* List of Quick Replies */}
                  <div className="md:col-span-2 space-y-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                      Saved Templates ({quickRepliesList.length})
                    </span>

                    {quickRepliesList.length === 0 ? (
                      <div className="bg-[#09090b] border border-zinc-850 rounded-xl p-8 text-center text-zinc-500 text-xs">
                        No quick replies defined for this WhatsApp line yet. Use the form on the left to add one!
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl bg-[#09090b] overflow-hidden">
                        {quickRepliesList.map((qr) => (
                          <div key={qr.id} className="p-4 flex items-start justify-between gap-4 text-xs group hover:bg-zinc-900/30 transition">
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded font-semibold">
                                  /{qr.shortcut}
                                </span>
                              </div>
                              <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed break-words">{qr.message}</p>
                            </div>

                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingQuickReplyId(qr.id);
                                  setEditQuickReplyForm({ shortcut: qr.shortcut, message: qr.message });
                                }}
                                className="text-xs text-emerald-400 hover:text-emerald-350 font-semibold cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteQuickReply(qr.id)}
                                className="text-xs text-rose-400 hover:text-rose-350 font-semibold cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
