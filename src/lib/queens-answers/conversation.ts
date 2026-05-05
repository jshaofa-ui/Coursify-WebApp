import { redis } from "@/lib/redis"

const CONVERSATION_KEY_PREFIX = "qa:conversation"
const MAX_MESSAGES_PER_SESSION = 5
const CONVERSATION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

// ── Types ────────────────────────────────────────────────────────────────

export type MessageRole = "user_question" | "ai_answer" | "error"

export type ConversationMessage = {
  role: MessageRole
  content: string
  timestamp: string // ISO 8601
}

// ── Helpers ──────────────────────────────────────────────────────────────

function conversationKey(userId: string): string {
  return `${CONVERSATION_KEY_PREFIX}:${userId}`
}

// ── Core Functions ───────────────────────────────────────────────────────

/**
 * Append a message to the user's conversation history.
 * Keeps only the last MAX_MESSAGES_PER_SESSION messages (FIFO eviction).
 */
export async function appendConversationMessage(
  userId: string,
  message: ConversationMessage,
): Promise<void> {
  const key = conversationKey(userId)

  // Push to the end of the list
  await redis.set // Use raw Redis via getRequiredRedisClient for list ops
    // Fallback: store as JSON array since our redis wrapper doesn't expose list ops
  const existing = await redis.get<ConversationMessage[]>(key)
  const messages: ConversationMessage[] = existing ?? []

  messages.push(message)

  // Keep only the last N messages
  const trimmed = messages.slice(-MAX_MESSAGES_PER_SESSION)

  await redis.set(key, trimmed, { ex: CONVERSATION_TTL_SECONDS })
}

/**
 * Retrieve the conversation history for a user.
 * Returns up to the last MAX_MESSAGES_PER_SESSION messages.
 */
export async function getConversationHistory(
  userId: string,
): Promise<ConversationMessage[]> {
  const key = conversationKey(userId)
  const messages = await redis.get<ConversationMessage[]>(key)
  return messages ?? []
}

/**
 * Get the conversation context as a formatted string for use in prompts.
 * Useful for providing context to the AI model.
 */
export async function getConversationContext(userId: string): Promise<string> {
  const messages = await getConversationHistory(userId)
  if (messages.length === 0) return ""

  return messages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n")
}

/**
 * Clear conversation history for a user.
 */
export async function clearConversationHistory(userId: string): Promise<void> {
  const key = conversationKey(userId)
  await redis.del(key)
}
