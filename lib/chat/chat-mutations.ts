/** Pure, in-place edits of a chat document; persistence lives in chat-store */

import type { ChatMessageData, ChatSession, ChatUpdates } from "./chat-types";

const DEFAULT_TITLE = "Новый чат";

/** Auto-generate a title from the first user message */
export function autoTitle(messages: ChatMessageData[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return DEFAULT_TITLE;
  const text = firstUser.content.trim();
  if (text.length <= 50) return text;
  return text.slice(0, 47) + "...";
}

function retitle(chat: ChatSession): void {
  if (chat.title === DEFAULT_TITLE && chat.messages.length > 0) {
    chat.title = autoTitle(chat.messages);
  }
}

export function applyChatUpdates(chat: ChatSession, updates: ChatUpdates): void {
  // Backward compat: initialize lastMessageAt for old chats that lack it
  if (!chat.lastMessageAt) {
    chat.lastMessageAt = chat.updatedAt;
  }

  if (updates.title !== undefined) chat.title = updates.title;
  if (updates.messages !== undefined) {
    // Appending leaves the context measurement valid; losing a message does not.
    const nextIds = new Set(updates.messages.map((m) => m.id));
    const removed = chat.messages.some((m) => !nextIds.has(m.id));
    if (removed) chat.revision = (chat.revision ?? 0) + 1;

    chat.messages = updates.messages;
    // Only update lastMessageAt when messages change (not on rename/model change)
    chat.lastMessageAt = new Date().toISOString();
  }
  if (updates.modelId !== undefined) chat.modelId = updates.modelId;
  if (updates.systemPrompt !== undefined) chat.systemPrompt = updates.systemPrompt;

  retitle(chat);
  chat.updatedAt = new Date().toISOString();
}

export function appendToChat(chat: ChatSession, newMessages: ChatMessageData[]): void {
  chat.messages.push(...newMessages);
  chat.updatedAt = new Date().toISOString();
  chat.lastMessageAt = chat.updatedAt;
  retitle(chat);
}

export function removeFromChat(chat: ChatSession, messageId: string): void {
  const remaining = chat.messages.filter((m) => m.id !== messageId);
  if (remaining.length !== chat.messages.length) {
    chat.revision = (chat.revision ?? 0) + 1;
  }
  chat.messages = remaining;
  chat.updatedAt = new Date().toISOString();
}

/**
 * Totals only grow; the context measurement is overwritten and stamped with
 * the revision it was taken at, so later deletions mark it as stale.
 */
export function addUsageToChat(
  chat: ChatSession,
  usage: { promptTokens: number; completionTokens: number },
  webSearchQueries: number,
  contextUsage: { promptTokens: number; completionTokens: number } = usage
): void {
  const totals = chat.usage;
  chat.usage = {
    promptTokens: (totals?.promptTokens ?? 0) + usage.promptTokens,
    completionTokens: (totals?.completionTokens ?? 0) + usage.completionTokens,
    requests: (totals?.requests ?? 0) + 1,
    webSearchQueries: (totals?.webSearchQueries ?? 0) + webSearchQueries,
    contextTokens: contextUsage.promptTokens + contextUsage.completionTokens,
    contextRevision: chat.revision ?? 0,
  };
}
