"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type CivicComplaint } from "@/lib/complaints";
import {
  SAMPLE_HAZARDS,
  type SampleHazard,
  generateSampleImageData,
} from "@/lib/sample-images";
import {
  Send,
  UploadCloud,
  Image as ImageIcon,
  X,
  Sparkles,
  AlertTriangle,
  Zap,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Building2,
  RefreshCw,
  ShieldAlert,
  Copy,
  Check,
  Search,
  ExternalLink,
  ChevronRight,
  Droplets,
  Activity,
  Layers,
  MessageSquare,
  Eye,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: string;
  image?: {
    dataUrl: string;
    mimeType?: string;
  };
  toolExecuted?: {
    name: string;
    args?: Record<string, any>;
    result?: {
      success?: boolean;
      name?: string;
      data?: CivicComplaint;
      message?: string;
      error?: string;
    };
  };
  isError?: boolean;
}

interface ImageUploadState {
  file?: File;
  dataUrl: string;
  base64: string;
  mimeType: string;
  name?: string;
  size?: string;
}

export default function CivicComplaintPage() {
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-welcome",
      role: "agent",
      text: "👋 Welcome to the City Civic Complaint Agent! Powered by Google Gemini and Cloud Firestore, I autonomously inspect civic hazards from photos, diagnose issues, assign the appropriate municipal department, and register official grievance tickets in real time.\n\nTry clicking any of the 1-Click Simulation Triggers above, upload your own photo, or track an existing ticket by asking: 'What's the status of ticket CIVIC-...'!",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageUploadState | null>(null);
  const [isAgentProcessing, setIsAgentProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  // Firestore live complaints state
  const [complaints, setComplaints] = useState<CivicComplaint[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [filterDepartment, setFilterDepartment] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // UI state
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "feed">("chat");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to latest message
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAgentProcessing, scrollToBottom]);

  // Real-time Firestore snapshot listener
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    setIsFeedLoading(true);

    try {
      const complaintsCol = collection(db, "complaints");
      const q = query(complaintsCol, orderBy("created_at", "desc"));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: CivicComplaint[] = [];
          snapshot.forEach((doc) => {
            items.push(doc.data() as CivicComplaint);
          });
          setComplaints(items);
          setIsFeedLoading(false);
        },
        (err) => {
          console.warn("Firestore ordered query failed, trying unsorted fallback:", err);
          // Fallback in case orderBy index is pending
          unsubscribe = onSnapshot(
            complaintsCol,
            (snapshot) => {
              const fallbackItems: CivicComplaint[] = [];
              snapshot.forEach((doc) => {
                fallbackItems.push(doc.data() as CivicComplaint);
              });
              fallbackItems.sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return timeB - timeA;
              });
              setComplaints(fallbackItems);
              setIsFeedLoading(false);
            },
            (fallbackErr) => {
              console.error("Firestore live feed snapshot failed:", fallbackErr);
              setIsFeedLoading(false);
            }
          );
        }
      );
    } catch (e) {
      console.error("Error initializing Firestore live feed:", e);
      setIsFeedLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle file selection
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (PNG, JPEG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
      const sizeKb = (file.size / 1024).toFixed(1) + " KB";

      setSelectedImage({
        file,
        dataUrl,
        base64,
        mimeType: file.type || "image/jpeg",
        name: file.name,
        size: sizeKb,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Submit message to /api/agent
  const submitMessage = async (customPayload?: {
    text: string;
    image?: { dataUrl: string; base64: string; mimeType: string };
  }) => {
    const textToSend = (customPayload ? customPayload.text : inputText).trim();
    const imageToSend = customPayload ? customPayload.image : selectedImage;

    if (!textToSend && !imageToSend) {
      return;
    }

    const userMessageId = `usr-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      text: textToSend || "Please inspect this civic hazard and file an official complaint.",
      timestamp: new Date().toISOString(),
      ...(imageToSend
        ? {
            image: {
              dataUrl: imageToSend.dataUrl,
              mimeType: imageToSend.mimeType,
            },
          }
        : {}),
    };

    // Append user message immediately
    setMessages((prev) => [...prev, userMessage]);
    if (!customPayload) {
      setInputText("");
      setSelectedImage(null);
    }

    setIsAgentProcessing(true);
    setProcessingStatus("Gemini is analyzing visual hazard & diagnosing civic issue...");

    try {
      // Build conversation history turns
      const historyPayload = messages
        .filter((m) => !m.isError && m.id !== "initial-welcome")
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          text: m.text,
        }));

      const bodyPayload: any = {
        message: userMessage.text,
        history: historyPayload,
      };

      if (imageToSend) {
        bodyPayload.image = {
          data: imageToSend.base64,
          mimeType: imageToSend.mimeType,
        };
      }

      setProcessingStatus("Routing to responsible municipal department & dispatching...");

      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Agent failed to process request.");
      }

      const agentMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        text: data.reply || "Grievance details processed successfully.",
        timestamp: new Date().toISOString(),
        toolExecuted: data.toolExecuted,
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (err: any) {
      console.error("Agent interaction error:", err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "agent",
        text: `⚠️ **Processing Error:** ${err.message || "Unable to reach civic agent service. Please try again."}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAgentProcessing(false);
      setProcessingStatus("");
    }
  };

  // 1-Click Simulation Trigger Handler
  const handleTriggerSample = (sample: SampleHazard) => {
    const { dataUrl, base64, mimeType } = generateSampleImageData(sample.id);
    submitMessage({
      text: sample.defaultPrompt,
      image: { dataUrl, base64, mimeType },
    });
  };

  // Copy Ticket ID helper
  const handleCopyTicket = (ticketId: string) => {
    navigator.clipboard.writeText(ticketId);
    setCopiedTicketId(ticketId);
    setTimeout(() => setCopiedTicketId(null), 2500);
  };

  // Pre-fill chat with ticket status query
  const handleTrackTicket = (ticketId: string) => {
    setInputText(`What's the status of ticket ${ticketId}?`);
    setMobileTab("chat");
  };

  // Reset conversation
  const handleResetChat = () => {
    if (confirm("Reset conversation history?")) {
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: "agent",
          text: "🔄 Chat session reset. Upload a civic hazard photo or click a 1-Click Trigger to file a new grievance.",
          timestamp: new Date().toISOString(),
        },
      ]);
      setSelectedImage(null);
      setInputText("");
    }
  };

  // Filter complaints list
  const filteredComplaints = complaints.filter((c) => {
    const matchesDept =
      filterDepartment === "ALL" || c.department === filterDepartment;
    const queryLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !queryLower ||
      c.ticket_id?.toLowerCase().includes(queryLower) ||
      c.issue_title?.toLowerCase().includes(queryLower) ||
      c.ward?.toLowerCase().includes(queryLower) ||
      c.department?.toLowerCase().includes(queryLower) ||
      c.assigned_officer?.toLowerCase().includes(queryLower);
    return matchesDept && matchesSearch;
  });

  // Badge helpers
  const getSeverityStyle = (severity?: string) => {
    switch (severity) {
      case "Critical":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      case "High":
        return "bg-orange-500/15 text-orange-400 border-orange-500/30";
      case "Medium":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "Low":
      default:
        return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    }
  };

  const getDepartmentStyle = (dept?: string) => {
    switch (dept) {
      case "Roads & Infrastructure":
        return "bg-zinc-800 text-zinc-200 border-zinc-700";
      case "Solid Waste Management":
        return "bg-emerald-950/60 text-emerald-300 border-emerald-800/50";
      case "Electricity & Streetlights":
        return "bg-amber-950/60 text-amber-300 border-amber-800/50";
      case "Stormwater & Drainage":
        return "bg-cyan-950/60 text-cyan-300 border-cyan-800/50";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case "Resolved":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "In Progress":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "Assigned":
      case "Filed":
      default:
        return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
    }
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return "Just now";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "Recently";
      const diff = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diff < 60) return "Just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Top Application Header */}
      <header className="h-16 flex-none border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <ShieldAlert className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Civic Complaint Agent
              </h1>
              <span className="hidden sm:inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                Phase 4 Demo
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5">
              <span>Built with Google Gemini & Firebase</span>
              <span className="text-zinc-600">•</span>
              <span className="hidden md:inline text-zinc-500">
                Autonomous Ward Grievance Dispatch
              </span>
            </p>
          </div>
        </div>

        {/* Right Header Status Badges */}
        <div className="flex items-center gap-3">
          {/* Mobile view toggle */}
          <div className="flex lg:hidden rounded-lg bg-zinc-800/80 p-0.5 border border-zinc-700">
            <button
              type="button"
              onClick={() => setMobileTab("chat")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                mobileTab === "chat"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("feed")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                mobileTab === "feed"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Feed ({complaints.length})
            </button>
          </div>

          {/* System status pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/60 text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-zinc-300 font-medium">Gemini 2.5 & Firestore Active</span>
          </div>

          {/* Reset session button */}
          <button
            type="button"
            onClick={handleResetChat}
            title="Reset Chat Session"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        {/* ============================================================ */}
        {/* LEFT COLUMN: Citizen Chat Interface (55% desktop width)      */}
        {/* ============================================================ */}
        <section
          className={`w-full lg:w-[55%] flex flex-col h-full border-r border-zinc-800/80 bg-zinc-950 transition-all ${
            mobileTab === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Top Quick Simulation Bar */}
          <div className="flex-none p-3 sm:p-4 border-b border-zinc-800/80 bg-zinc-900/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>1-Click Zero-Friction Demo Samples</span>
              </div>
              <span className="text-[11px] text-zinc-500 hidden sm:inline">
                Simulates citizen visual report
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {SAMPLE_HAZARDS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  disabled={isAgentProcessing}
                  onClick={() => handleTriggerSample(sample)}
                  className="group relative flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800/90 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {sample.id === "pothole" && (
                      <AlertTriangle className="h-4 w-4 text-rose-400 group-hover:scale-110 transition-transform" />
                    )}
                    {sample.id === "garbage" && (
                      <Trash2 className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    )}
                    {sample.id === "streetlight" && (
                      <Zap className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                      {sample.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 line-clamp-1">
                    {sample.department}
                  </span>
                </button>
              ))}
            </div>

            {/* Compact File Upload Dropzone */}
            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {!selectedImage ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center justify-center gap-2.5 px-3 py-2 rounded-xl border border-dashed transition-all cursor-pointer ${
                    isDragging
                      ? "border-indigo-400 bg-indigo-500/10"
                      : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/70 hover:border-zinc-700"
                  }`}
                >
                  <UploadCloud className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs text-zinc-400">
                    <span className="text-indigo-400 font-medium">Click to upload</span> or drag & drop civic hazard photo (PNG, JPEG)
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 rounded-xl border border-indigo-500/40 bg-indigo-950/20 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    {/* Thumbnail preview */}
                    <img
                      src={selectedImage.dataUrl}
                      alt="Upload preview"
                      className="h-10 w-14 rounded-lg object-cover border border-zinc-700 shadow"
                    />
                    <div>
                      <p className="text-xs font-medium text-zinc-200 line-clamp-1">
                        {selectedImage.name || "Evidence photo loaded"}
                      </p>
                      <p className="text-[11px] text-indigo-400 font-mono">
                        Ready to submit {selectedImage.size ? `(${selectedImage.size})` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                    title="Remove attached photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Middle: Scrollable Message Thread */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`flex items-start gap-3 max-w-[92%] sm:max-w-[85%] ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    {!isUser ? (
                      <div className="flex-none h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/10 mt-0.5">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                    ) : (
                      <div className="flex-none h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300 border border-zinc-700 mt-0.5">
                        <User className="h-4 w-4" />
                      </div>
                    )}

                    {/* Message Bubble Container */}
                    <div
                      className={`flex flex-col rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? "bg-indigo-600 text-white rounded-tr-sm"
                          : msg.isError
                          ? "bg-rose-950/40 border border-rose-800/60 text-rose-200 rounded-tl-sm"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm"
                      }`}
                    >
                      {/* Attached Image Thumbnail */}
                      {msg.image?.dataUrl && (
                        <div className="mb-2.5">
                          <img
                            src={msg.image.dataUrl}
                            alt="Citizen uploaded civic hazard evidence"
                            className="max-h-48 rounded-lg object-cover border border-black/20 shadow cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => setModalImage(msg.image!.dataUrl)}
                          />
                        </div>
                      )}

                      {/* Main Text Content */}
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {/* Tool Execution Card (Agent Action) */}
                      {msg.toolExecuted && (
                        <div className="mt-3 pt-3 border-t border-zinc-800/90 flex flex-col gap-2.5">
                          {/* Tool Header */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-mono text-xs">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              <span>{msg.toolExecuted.name}</span>
                            </span>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                              Autonomous Dispatch
                            </span>
                          </div>

                          {/* If file_civic_complaint or check_complaint_status returned complaint data */}
                          {msg.toolExecuted.result?.data && (
                            <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 p-3 space-y-2.5">
                              {/* Ticket ID & Status Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-zinc-400 font-medium">Ticket:</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyTicket(
                                        msg.toolExecuted!.result!.data!.ticket_id
                                      )
                                    }
                                    className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-xs font-mono font-bold text-indigo-300 hover:border-indigo-400 transition-colors"
                                    title="Click to copy ticket ID"
                                  >
                                    <span>{msg.toolExecuted.result.data.ticket_id}</span>
                                    {copiedTicketId ===
                                    msg.toolExecuted.result.data.ticket_id ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3 w-3 text-zinc-500 group-hover:text-zinc-300" />
                                    )}
                                  </button>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusStyle(
                                    msg.toolExecuted.result.data.status
                                  )}`}
                                >
                                  {msg.toolExecuted.result.data.status}
                                </span>
                              </div>

                              {/* Issue Title & Department */}
                              <div>
                                <h4 className="text-xs font-semibold text-white">
                                  {msg.toolExecuted.result.data.issue_title}
                                </h4>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getDepartmentStyle(
                                      msg.toolExecuted.result.data.department
                                    )}`}
                                  >
                                    {msg.toolExecuted.result.data.department}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getSeverityStyle(
                                      msg.toolExecuted.result.data.severity
                                    )}`}
                                  >
                                    {msg.toolExecuted.result.data.severity} Risk
                                  </span>
                                </div>
                              </div>

                              {/* Officer & ETA */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-zinc-900 text-xs text-zinc-400">
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-zinc-500" />
                                  <span className="truncate">
                                    {msg.toolExecuted.result.data.assigned_officer}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5 text-zinc-500" />
                                  <span>{msg.toolExecuted.result.data.resolution_eta}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Timestamp */}
                      <span
                        className={`text-[10px] mt-1.5 self-end ${
                          isUser ? "text-indigo-200" : "text-zinc-500"
                        }`}
                      >
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Agent Processing Indicator */}
            {isAgentProcessing && (
              <div className="flex items-start gap-3">
                <div className="flex-none h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/10 animate-pulse">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-tl-sm shadow-sm">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                  </span>
                  <span className="font-medium text-zinc-300">
                    {processingStatus || "Gemini is processing..."}
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <div className="flex-none p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* Quick file trigger */}
              <button
                type="button"
                disabled={isAgentProcessing}
                onClick={() => fileInputRef.current?.click()}
                title="Attach photo"
                className="flex-none p-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-indigo-400 hover:border-zinc-700 transition-colors disabled:opacity-50"
              >
                <ImageIcon className="h-5 w-5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isAgentProcessing}
                placeholder="Describe civic issue or ask 'What's the status of ticket CIVIC-...'"
                className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-50"
              />

              {/* Submit button */}
              <button
                type="submit"
                disabled={isAgentProcessing || (!inputText.trim() && !selectedImage)}
                className="flex-none inline-flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </section>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Municipal Live Feed (45% desktop width)        */}
        {/* ============================================================ */}
        <section
          className={`w-full lg:w-[45%] flex flex-col h-full bg-zinc-950/70 transition-all ${
            mobileTab === "feed" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Feed Header */}
          <div className="flex-none p-4 border-b border-zinc-800/80 bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Ward Grievance Dispatch (Real-Time)
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-mono font-medium text-zinc-300">
                {complaints.length} Filed
              </span>
            </div>

            {/* Department Filter Pills */}
            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 text-xs">
              {[
                { id: "ALL", label: "All Grievances" },
                { id: "Roads & Infrastructure", label: "Roads" },
                { id: "Solid Waste Management", label: "Waste" },
                { id: "Electricity & Streetlights", label: "Electricity" },
                { id: "Stormwater & Drainage", label: "Drainage" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterDepartment(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    filterDepartment === tab.id
                      ? "bg-zinc-100 text-zinc-950 shadow"
                      : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search filter input */}
            <div className="relative mt-2.5">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ticket ID, ward, department, or keyword..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Feed Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
            {isFeedLoading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-3 text-zinc-400">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                <p className="text-xs">Connecting to Cloud Firestore live feed...</p>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 text-center my-6">
                <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                  <ShieldAlert className="h-6 w-6 text-zinc-500" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-1">
                  No active grievances found
                </h3>
                <p className="text-xs text-zinc-500 max-w-xs">
                  {searchQuery || filterDepartment !== "ALL"
                    ? "No grievances match your current search criteria."
                    : "Upload a civic hazard photo or trigger a 1-click simulation sample to file the first ticket!"}
                </p>
              </div>
            ) : (
              filteredComplaints.map((complaint) => (
                <div
                  key={complaint.ticket_id}
                  className="group relative rounded-xl border border-zinc-800/90 bg-zinc-900/80 hover:bg-zinc-900 hover:border-zinc-700 transition-all duration-200 p-4 shadow-sm hover:shadow-md"
                >
                  {/* Card Header: Ticket ID, Time, Status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyTicket(complaint.ticket_id)}
                        className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 px-2 py-0.5 rounded hover:border-indigo-500 transition-colors flex items-center gap-1"
                        title="Click to copy ticket ID"
                      >
                        <span>{complaint.ticket_id}</span>
                        {copiedTicketId === complaint.ticket_id ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-zinc-500" />
                        )}
                      </button>
                      <span className="text-[11px] text-zinc-500">
                        {formatTimestamp(complaint.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusStyle(
                          complaint.status
                        )}`}
                      >
                        {complaint.status}
                      </span>
                    </div>
                  </div>

                  {/* Title & Ward */}
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-white group-hover:text-indigo-200 transition-colors">
                      {complaint.issue_title}
                    </h3>
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">
                        {complaint.ward}
                        {complaint.landmark ? ` • Near ${complaint.landmark}` : ""}
                      </span>
                    </p>
                  </div>

                  {/* Description snippet */}
                  {complaint.description && (
                    <p className="text-xs text-zinc-400 mb-3 line-clamp-2 leading-relaxed">
                      {complaint.description}
                    </p>
                  )}

                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getSeverityStyle(
                        complaint.severity
                      )}`}
                    >
                      {complaint.severity} Severity
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getDepartmentStyle(
                        complaint.department
                      )}`}
                    >
                      {complaint.department}
                    </span>
                  </div>

                  {/* Footer: Officer, ETA & Actions */}
                  <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="flex items-center gap-1 text-[11px] text-zinc-300">
                        <User className="h-3 w-3 text-zinc-500" />
                        <span className="truncate max-w-[160px]">
                          {complaint.assigned_officer}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        <span>{complaint.resolution_eta}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {complaint.image_data && (
                        <button
                          type="button"
                          onClick={() =>
                            setModalImage(`data:image/jpeg;base64,${complaint.image_data}`)
                          }
                          className="p-1 rounded-md bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                          title="View evidence photo"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTrackTicket(complaint.ticket_id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 hover:bg-indigo-600 hover:text-white transition-all text-[11px] font-medium"
                      >
                        <span>Track</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Lightbox Evidence Modal */}
      {modalImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setModalImage(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-zinc-800 bg-zinc-950/80">
              <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-indigo-400" />
                Civic Hazard Visual Evidence
              </h3>
              <button
                type="button"
                onClick={() => setModalImage(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 bg-zinc-950 flex items-center justify-center">
              <img
                src={modalImage}
                alt="Enlarged civic hazard evidence"
                className="max-h-[70vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
