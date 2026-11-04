import type { MessageGrounding } from "../web-tools/grounding";

export interface ChatAttachment {
  type: "image" | "file";
  name: string;
  mimeType: string;
  /** For small files: base64 data. For large files: path to saved file */
  url: string;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  attachments?: ChatAttachment[];
  /** Web-grounding provenance; kept out of `content` so it never reaches the LLM */
  grounding?: MessageGrounding;
  createdAt: string;
}

export interface ChatUsageTotals {
  /** Append-only: deleting messages never gives spent tokens back */
  promptTokens: number;
  completionTokens: number;
  requests: number;
  /** Append-only count of billable Google Search queries */
  webSearchQueries?: number;
  /** Last exact context size reported by the provider */
  contextTokens: number;
  /** Chat revision the context measurement was taken at */
  contextRevision: number;
}

export interface ChatSession {
  id: string;
  title: string;
  modelId: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
  /** Updated only when messages change; used for sorting. Missing in old files — falls back to updatedAt. */
  lastMessageAt?: string;
  /** Bumped only when messages are removed; missing in old files means 0 */
  revision?: number;
  /** Token aggregate; absent when a plugin owns the consumption journal */
  usage?: ChatUsageTotals;
  messages: ChatMessageData[];
}

export interface ChatListItem {
  id: string;
  title: string;
  modelId: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
  /** Always populated (falls back to updatedAt for old chats) */
  lastMessageAt: string;
  messageCount: number;
}

export type ChatUpdates = Partial<Pick<ChatSession, "title" | "messages" | "modelId" | "systemPrompt">>;
