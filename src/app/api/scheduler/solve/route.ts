import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessProductionScheduling } from "@/lib/scheduler-access";
import { getAvailabilityCompleteness } from "@/lib/availability";
import { validateSolverPrecedences, type SolverPrecedence } from "@/lib/scheduling";

const REQUEST_TIMEOUT_MS = 20_000;

function getProductionId(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("productionId")?.trim() ?? "";
}

function getSchedulerConfig() {
  const baseUrl = process.env.SCHEDULER_BASE_URL?.trim();
  const apiKey = process.env.SCHEDULER_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
  };
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const productionId = getProductionId(request);
  if (!productionId) {
    return NextResponse.json({ error: "Missing productionId" }, { status: 400 });
  }

  const canAccess = await canAccessProductionScheduling(userId, productionId);
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const completeness = await getAvailabilityCompleteness(productionId);
  if (!completeness.isComplete) {
    return NextResponse.json(
      {
        error: "Availability is incomplete. Scheduling is blocked.",
        missing_members: completeness.missingMembers,
        total_members: completeness.totalMembers,
        required_members: completeness.requiredMembers,
        submitted_members: completeness.submittedMembers,
      },
      { status: 409 }
    );
  }

  const config = getSchedulerConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Scheduler is not configured" },
      { status: 500 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as {
      blocks?: Array<{ id?: unknown }>;
      precedences?: SolverPrecedence[];
    };

    if (Array.isArray(candidate.precedences)) {
      const blockIds = Array.isArray(candidate.blocks)
        ? candidate.blocks
            .map((block) => (typeof block?.id === "string" ? block.id : null))
            .filter((id): id is string => Boolean(id))
        : [];
      const precedenceErrors = validateSolverPrecedences({
        blockIds,
        precedences: candidate.precedences,
      });

      if (precedenceErrors.length > 0) {
        return NextResponse.json(
          { error: precedenceErrors.join(" ") },
          { status: 400 }
        );
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${config.baseUrl}/solve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    const rawBody = await upstream.text();
    try {
      const jsonBody = rawBody.length > 0 ? JSON.parse(rawBody) : null;
      return NextResponse.json(jsonBody, { status: upstream.status });
    } catch {
      return NextResponse.json(
        {
          error: "Scheduler returned non-JSON response",
          upstreamStatus: upstream.status,
          upstreamBody: rawBody.slice(0, 2000),
        },
        { status: upstream.status }
      );
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: `Scheduler request timed out after ${REQUEST_TIMEOUT_MS}ms` },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Unable to reach scheduler service" },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
