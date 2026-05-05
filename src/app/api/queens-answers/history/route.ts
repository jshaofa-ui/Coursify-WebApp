import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedSupabaseFromRequest } from "@/app/api/_lib/authenticated-supabase"
import { getConversationHistory } from "@/lib/queens-answers/conversation"

const DEFAULT_LIMIT = 10

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabaseFromRequest(request)
  if (!auth.ok && auth.reason === "server_configuration") {
    return NextResponse.json(
      { error: "Server configuration error", reason: "dependency_failure", dependency: "supabase" },
      { status: 500 },
    )
  }
  if (!auth.ok && auth.reason === "missing_token") {
    return NextResponse.json(
      { error: "Unauthorized", reason: "unauthorized" },
      { status: 401 },
    )
  }
  if (!auth.ok && auth.reason === "forbidden_domain") {
    return NextResponse.json(
      { error: auth.error, reason: "forbidden_domain" },
      { status: 403 },
    )
  }
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Authentication failed", reason: "unauthorized" },
      { status: 401 },
    )
  }

  const { user } = auth

  // Parse optional limit query param
  const url = new URL(request.url)
  const limitParam = url.searchParams.get("limit")
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 50) : DEFAULT_LIMIT

  try {
    const messages = await getConversationHistory(user.id)

    // Return the last `limit` messages, most recent first
    const recent = messages.slice(-limit).reverse()

    return NextResponse.json({
      messages: recent,
      total: messages.length,
    })
  } catch (error) {
    console.error("[queens-answers/history] failed to fetch conversation history:", error)
    return NextResponse.json(
      { error: "Failed to retrieve conversation history", reason: "dependency_failure" },
      { status: 500 },
    )
  }
}
