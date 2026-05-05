import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/app/api/_lib/authenticated-supabase";
import { getConfirmedAccessStatus } from "@/app/api/_lib/confirmed-access-status";
import { checkRateLimit } from "@/app/api/_lib/rate-limit";
import { consumeQuestion, checkBurstRateLimit, formatBurstLimitMessage } from "@/lib/queens-answers/rate-limit";
import { getCachedAnswer, setCachedAnswer, recordCacheHit, recordCacheMiss } from "@/lib/queens-answers/cache";
import { appendConversationMessage } from "@/lib/queens-answers/conversation";
import { incrementQuestionCount, recordResponseTime } from "@/lib/queens-answers/metrics";
import { z } from "zod";

const chatQuestionSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(2000, "Question is too long (max 2000 characters)"),
}).strict();

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabaseFromRequest(request);
  if (!auth.ok && auth.reason === "server_configuration") {
    return NextResponse.json(
      { error: "Server configuration error", reason: "dependency_failure", dependency: "supabase" },
      { status: 500 },
    );
  }
  if (!auth.ok && auth.reason === "missing_token") {
    return NextResponse.json(
      { error: "Unauthorized", reason: "unauthorized" },
      { status: 401 },
    );
  }
  if (!auth.ok && auth.reason === "forbidden_domain") {
    return NextResponse.json(
      { error: auth.error, reason: "forbidden_domain" },
      { status: 403 },
    );
  }
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Authentication failed", reason: "unauthorized" },
      { status: 401 },
    );
  }

  const { supabase, user } = auth;

  // ── Burst rate limiting (per-minute, 10 requests) ──────────────────────
  const burstLimit = await checkBurstRateLimit(user.id);
  if (!burstLimit.ok && burstLimit.reason === "dependency_failure") {
    console.warn("[queens-answers/chat] burst rate-limit unavailable, failing open");
  }
  if (!burstLimit.ok && burstLimit.reason === "burst_rate_limit") {
    return NextResponse.json(
      {
        error: formatBurstLimitMessage(burstLimit.retryAfterSeconds),
        reason: "rate_limit",
        retry_after: burstLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(burstLimit.retryAfterSeconds),
          "X-RateLimit-Limit": String(burstLimit.limit),
        },
      },
    );
  }

  // ── Global burst rate limiting (existing) ──────────────────────────────
  const globalBurst = await checkRateLimit({
    keyPrefix: "queens-answers:chat:user",
    identifier: user.id,
    limit: 20,
    windowSeconds: 60,
  });
  if (!globalBurst.ok && globalBurst.reason === "dependency_failure") {
    console.warn("[queens-answers/chat] burst rate-limit unavailable, failing open");
  }
  if (!globalBurst.ok && globalBurst.reason !== "dependency_failure") {
    return NextResponse.json(
      {
        error: "Too many requests. Try again shortly.",
        reason: "rate_limit",
      },
      { status: 429 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsedBody = chatQuestionSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const { question } = parsedBody.data;
  const startTime = Date.now();

  // ── Check cache first ──────────────────────────────────────────────────
  const cached = await getCachedAnswer(question);
  if (cached.hit) {
    await recordCacheHit();

    // Store in conversation history
    await Promise.all([
      appendConversationMessage(user.id, {
        role: "user_question",
        content: question,
        timestamp: new Date().toISOString(),
      }),
      appendConversationMessage(user.id, {
        role: "ai_answer",
        content: cached.answer,
        timestamp: new Date().toISOString(),
      }),
      recordResponseTime(Date.now() - startTime),
    ]);

    const response = NextResponse.json({
      answer: cached.answer,
      remaining: null, // Not consuming quota for cached answers
      cached: true,
    });
    response.headers.set("X-Cache", "HIT");
    return response;
  }

  // Cache miss — continue with normal flow
  await recordCacheMiss();

  // ── Access check ───────────────────────────────────────────────────────
  const accessResult = await getConfirmedAccessStatus(supabase, user.id);
  if (!accessResult.ok) {
    return NextResponse.json(
      {
        error: accessResult.error,
        reason: accessResult.reason,
        dependency: accessResult.dependency,
      },
      { status: 503 },
    );
  }

  if (!accessResult.status.has_access) {
    return NextResponse.json(
      {
        error: "Queen's Answers access is locked until your contribution requirements are met.",
        reason: "entitlement_required",
      },
      { status: 403 },
    );
  }

  // ── Daily quota check ──────────────────────────────────────────────────
  const consumeResult = await consumeQuestion(supabase, user.id, accessResult.semestersCompleted);
  if (!consumeResult.ok && consumeResult.reason === "dependency_failure") {
    return NextResponse.json(
      {
        error: consumeResult.error,
        reason: consumeResult.reason,
        dependency: consumeResult.dependency,
      },
      { status: 503 },
    );
  }

  if (!consumeResult.ok && consumeResult.reason === "rate_limit") {
    return NextResponse.json(
      {
        error: `You've used your ${consumeResult.usage.dailyLimit} daily questions. Resets within 24 hours.`,
        reason: "rate_limit",
      },
      { status: 429 },
    );
  }

  // ── AI response (placeholder) ──────────────────────────────────────────
  // TODO: Replace with Gemini 2.0 Flash call.
  // If the AI API returns a rate limit error, return:
  // { answer: "API rate limit achieved for the system. It resets daily.", remaining: Math.max(0, tierLimit - newUserCount) }
  const delay = 1500 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));
  const answer =
    "Queen's Answers is still in the works — we're aiming to have it ready in time for Fall '26 course selection. In the meantime, view all our available courses and upload your grade distributions to help build the database!";

  // ── Cache the response, track metrics, store conversation ──────────────
  await Promise.all([
    setCachedAnswer(question, answer),
    incrementQuestionCount(user.id),
    recordResponseTime(Date.now() - startTime),
    appendConversationMessage(user.id, {
      role: "user_question",
      content: question,
      timestamp: new Date().toISOString(),
    }),
    appendConversationMessage(user.id, {
      role: "ai_answer",
      content: answer,
      timestamp: new Date().toISOString(),
    }),
  ]);

  const response = NextResponse.json({
    answer,
    remaining: consumeResult.usage.remaining,
    cached: false,
  });
  response.headers.set("X-Cache", "MISS");
  return response;
}
