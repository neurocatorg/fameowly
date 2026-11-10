"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { ChatAttachment, Mode, ImageHistoryItemClient } from "@/lib/types";
import { SYSTEM_PROMPT_PRESETS } from "@/lib/constants/system-prompts";
import { getDefaultModel } from "@/lib/models";
import { closestReasoningLevel, reasoningLevelsOf } from "@/lib/reasoning-levels";
import { usePersistentChat } from "./use-persistent-chat";
import { useFileUpload } from "./use-file-upload";
import { useImageGeneration } from "./use-image-generation";
import { useImageHistory } from "./use-image-history";
import { useModels } from "./use-models";
import { useChatSettings } from "./use-chat-settings";
import { usePaymentRequired } from "./use-payment-required";

export function usePageState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { chatModels, imageModels, selectedModel, setSelectedModel, selectedImageModel, setSelectedImageModel } = useModels();
  const { imageHistory, loadImageHistory } = useImageHistory();

  const [mode, setMode] = useState<Mode>(() => {
    const m = searchParams.get("mode");
    return m === "image" || m === "video" ? m : "chat";
  });
  const [selectedPresetId, setSelectedPresetId] = useState("default");
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [showSystemPromptPanel, setShowSystemPromptPanel] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAllChats, setShowAllChats] = useState(false);
  const [input, setInput] = useState("");

  const fileUpload = useFileUpload(mode);
  const payment = usePaymentRequired(setInput, fileUpload.setPendingAttachments);
  const chat = usePersistentChat(payment.onChatRefused);

  // Per-chat settings (Task 4: persisted in localStorage per chat)
  const {
    temperature, setTemperature,
    reasoningLevel: wantedReasoningLevel, setReasoningLevel,
    webSearchEnabled, setWebSearchEnabled,
    resetToDefaults,
  } = useChatSettings(chat.activeChatId);

  const isLoading = chat.status === "streaming" || chat.status === "submitted";
  const isReasoningPhase = chat.status === "streaming" && (() => {
    const last = chat.messages[chat.messages.length - 1];
    return last?.role === "assistant" && !!last.reasoning && !last.content;
  })();
  const currentSystemPrompt = selectedPresetId === "custom"
    ? customSystemPrompt
    : SYSTEM_PROMPT_PRESETS.find((p) => p.id === selectedPresetId)?.prompt || SYSTEM_PROMPT_PRESETS[0].prompt;

  // Ghost model detection: check if the current chat's model is still available
  const modelUnavailable = useMemo(() => {
    if (!chat.activeChatId) return false;
    return !chatModels.some((m) => m.id === selectedModel.id);
  }, [chat.activeChatId, chatModels, selectedModel.id]);

  // Model capability flags — admin-controlled in models.json, no provider hardcoding
  const supportsTemperature = selectedModel.supportsTemperature ?? false;
  const supportsWebSearch = selectedModel.supportsWebSearch ?? false;
  const reasoningLevels = useMemo(() => reasoningLevelsOf(selectedModel), [selectedModel]);
  const reasoningLevel = closestReasoningLevel(wantedReasoningLevel, reasoningLevels);

  // Always explicit: a model without web-search support must never attach the tool
  const requestOptions = useMemo(() => ({
    temperature: supportsTemperature ? temperature : undefined,
    reasoningLevel,
    webSearchEnabled: supportsWebSearch && webSearchEnabled,
  }), [supportsTemperature, temperature, reasoningLevel, supportsWebSearch, webSearchEnabled]);

  const imageGen = useImageGeneration({
    selectedImageModel,
    imageRefAttachments: fileUpload.imageRefAttachments,
    setImageRefAttachments: fileUpload.setImageRefAttachments,
    loadImageHistory,
    onPaymentRequired: payment.onImageRefused,
  });

  // Route sync: read URL on mount
  const initialRouteLoaded = useRef(false);
  useEffect(() => {
    if (initialRouteLoaded.current) return;
    initialRouteLoaded.current = true;
    const chatId = searchParams.get("chat");
    if (chatId) chat.loadChat(chatId);
  }, [searchParams, chat.loadChat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Route sync: push URL on state change
  useEffect(() => {
    const params = new URLSearchParams();
    if (mode !== "chat") params.set("mode", mode);
    if (mode === "chat" && chat.activeChatId) params.set("chat", chat.activeChatId);
    const newUrl = params.toString() ? `/?${params.toString()}` : "/";
    if (window.location.pathname + window.location.search !== newUrl) router.replace(newUrl, { scroll: false });
  }, [mode, chat.activeChatId, router]);

  // Sync system prompt preset when loading a chat
  useEffect(() => {
    if (!chat.chatSystemPrompt) { setSelectedPresetId("default"); setCustomSystemPrompt(""); return; }
    const matched = SYSTEM_PROMPT_PRESETS.find((p) => p.id !== "custom" && p.prompt === chat.chatSystemPrompt);
    if (matched) { setSelectedPresetId(matched.id); setCustomSystemPrompt(""); }
    else { setSelectedPresetId("custom"); setCustomSystemPrompt(chat.chatSystemPrompt); }
  }, [chat.chatSystemPrompt]);

  useEffect(() => { chat.loadChatList(); }, [chat.loadChatList]); // eslint-disable-line react-hooks/exhaustive-deps

  // When model is changed in an existing chat, update chat.modelId on server
  const handleModelChange = useCallback((model: typeof selectedModel) => {
    setSelectedModel(model);
    if (chat.activeChatId) {
      // Update chat's model on server
      fetch("/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chat.activeChatId, modelId: model.id }),
      }).catch(() => { /* silent */ });
    }
  }, [chat.activeChatId, setSelectedModel]);

  // Handlers
  const handleChatSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || modelUnavailable) return;
    const attachments: ChatAttachment[] = fileUpload.pendingAttachments
      .filter((pa) => pa.uploaded && !pa.error)
      .map((pa) => pa.uploaded!);
    const sp = chat.messages.length === 0 ? currentSystemPrompt : undefined;

    payment.rememberDraft(input, fileUpload.pendingAttachments);
    chat.sendMessage(input, selectedModel, attachments.length ? attachments : undefined, sp, requestOptions);
    setInput(""); fileUpload.setPendingAttachments([]);
  }, [input, isLoading, modelUnavailable, fileUpload, chat, payment, currentSystemPrompt, requestOptions, selectedModel]);

  const handleNewChat = useCallback(() => {
    chat.clearChat(); setSelectedPresetId("default"); setCustomSystemPrompt("");
    setShowSystemPromptPanel(false); setSidebarOpen(false);
    resetToDefaults();
    // Task 5: Reset to default model (first basic tier)
    setSelectedModel(getDefaultModel(chatModels));
  }, [chat, chatModels, setSelectedModel, resetToDefaults]);

  const handleSelectChat = useCallback((chatId: string) => {
    chat.loadChat(chatId); setMode("chat"); setSidebarOpen(false);
  }, [chat]);

  // After loading a chat, sync the model from chat data
  useEffect(() => {
    if (!chat.activeChatId || !chat.chatList.length) return;
    const activeChat = chat.chatList.find((c) => c.id === chat.activeChatId);
    if (activeChat?.modelId) {
      const chatModel = chatModels.find((m) => m.id === activeChat.modelId);
      if (chatModel) {
        setSelectedModel(chatModel);
      }
      // If model not found — modelUnavailable will be true via useMemo
    }
  }, [chat.activeChatId, chat.chatList, chatModels, setSelectedModel]);

  const handleSelectImageItem = useCallback((item: ImageHistoryItemClient) => {
    imageGen.setSelectedImageItem(item); imageGen.setImageUrl(item.imageUrl);
    imageGen.setImageError(""); setSidebarOpen(false);
  }, [imageGen]);

  const handleNewImageGeneration = useCallback(() => {
    imageGen.setSelectedImageItem(null); imageGen.setImageUrl(null); imageGen.setImageError("");
  }, [imageGen]);

  const handleWebSearchToggle = useCallback(() => {
    setWebSearchEnabled(!webSearchEnabled);
  }, [webSearchEnabled, setWebSearchEnabled]);

  return {
    mode, setMode, sidebarOpen, setSidebarOpen, showAllChats, setShowAllChats,
    chatModels, imageModels, selectedModel, setSelectedModel: handleModelChange, selectedImageModel, setSelectedImageModel,
    ...chat, isLoading, isReasoningPhase, modelUnavailable,
    input, setInput,
    selectedPresetId, setSelectedPresetId, customSystemPrompt, setCustomSystemPrompt,
    showSystemPromptPanel, setShowSystemPromptPanel, currentSystemPrompt,
    reasoningLevels, reasoningLevel, setReasoningLevel, temperature, setTemperature,
    webSearchEnabled, handleWebSearchToggle,
    supportsTemperature, supportsWebSearch, requestOptions,
    ...fileUpload, ...imageGen, imageHistory,
    paymentRequired: payment.reason, dismissPaymentRequired: payment.dismiss,
    handleChatSubmit, handleNewChat, handleSelectChat, handleSelectImageItem, handleNewImageGeneration,
  };
}

