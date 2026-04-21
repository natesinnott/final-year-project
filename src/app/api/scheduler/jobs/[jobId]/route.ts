import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkInMemoryRateLimit } from "@/lib/in-memory-rate-limit";
import { canAccessProductionScheduling } from "@/lib/scheduler-access";

const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_RATE_LIMIT = 180;
const RATE_LIMIT_WINDOW_MS = 60_000;
const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

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

function getPositiveInteger(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rateLimitExceededResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many scheduler polling requests. Try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

export async function GET(request: Request, { params }: RouteParams) {
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

  const pollRateLimit = checkInMemoryRateLimit({
    key: `scheduler:poll:user:${userId}:production:${productionId}`,
    maxHits: getPositiveInteger(
      "SCHEDULER_POLL_RATE_LIMIT_PER_USER",
      DEFAULT_POLL_RATE_LIMIT
    ),
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!pollRateLimit.allowed) {
    return rateLimitExceededResponse(pollRateLimit.retryAfterSeconds);
  }

  const config = getSchedulerConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Scheduler is not configured" },
      { status: 500 }
    );
  }

  const resolvedParams = await params;
  const jobId = resolvedParams.jobId?.trim();

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  // Scheduler job ids are opaque and not production-scoped, so polling is still
  // gated by production access and a strict UUID shape check here.
  if (!JOB_ID_PATTERN.test(jobId)) {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(
      `${config.baseUrl}/jobs/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers: {
          "x-api-key": config.apiKey,
        },
        signal: controller.signal,
        cache: "no-store",
      }
    );

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
