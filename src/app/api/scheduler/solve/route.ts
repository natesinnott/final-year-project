import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessProductionScheduling } from "@/lib/scheduler-access";
import { getAvailabilityCompleteness } from "@/lib/availability";
import { checkInMemoryRateLimit } from "@/lib/in-memory-rate-limit";
import {
  DEFAULT_SOLVER_PAYLOAD_LIMITS,
  normalizeAllowedTimeWindowInput,
  normalizeSolverTimeZoneInput,
  validateSolverPayloadWorkload,
  validateSolverPrecedences,
  type SolverPayloadLimits,
  type SolverPrecedence,
} from "@/lib/scheduling";

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_REQUEST_BYTES = 1_000_000;
const DEFAULT_SOLVE_RATE_LIMIT = 6;
const DEFAULT_PRODUCTION_SOLVE_RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

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

function getSolverPayloadLimits(): SolverPayloadLimits {
  return {
    maxBlocks: getPositiveInteger(
      "SCHEDULER_MAX_BLOCKS",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxBlocks
    ),
    maxPeople: getPositiveInteger(
      "SCHEDULER_MAX_PEOPLE",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxPeople
    ),
    maxRooms: getPositiveInteger(
      "SCHEDULER_MAX_ROOMS",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxRooms
    ),
    maxAvailabilityWindows: getPositiveInteger(
      "SCHEDULER_MAX_AVAILABILITY_WINDOWS",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxAvailabilityWindows
    ),
    maxPrecedences: getPositiveInteger(
      "SCHEDULER_MAX_PRECEDENCES",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxPrecedences
    ),
    maxRequiredPeoplePerBlock: getPositiveInteger(
      "SCHEDULER_MAX_REQUIRED_PEOPLE_PER_BLOCK",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxRequiredPeoplePerBlock
    ),
    maxTotalRequiredPeopleReferences: getPositiveInteger(
      "SCHEDULER_MAX_REQUIRED_PEOPLE_REFERENCES",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxTotalRequiredPeopleReferences
    ),
    maxAllowedRoomsPerBlock: getPositiveInteger(
      "SCHEDULER_MAX_ALLOWED_ROOMS_PER_BLOCK",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxAllowedRoomsPerBlock
    ),
    maxDurationOptionsPerBlock: getPositiveInteger(
      "SCHEDULER_MAX_DURATION_OPTIONS_PER_BLOCK",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxDurationOptionsPerBlock
    ),
    maxHorizonDays: getPositiveInteger(
      "SCHEDULER_MAX_HORIZON_DAYS",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxHorizonDays
    ),
    maxIdLength: getPositiveInteger(
      "SCHEDULER_MAX_ID_LENGTH",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxIdLength
    ),
    maxSolveSeconds: getPositiveInteger(
      "SCHEDULER_MAX_SOLVE_SECONDS",
      DEFAULT_SOLVER_PAYLOAD_LIMITS.maxSolveSeconds
    ),
  };
}

function getBodySizeLimitBytes() {
  return getPositiveInteger("SCHEDULER_MAX_REQUEST_BYTES", DEFAULT_MAX_REQUEST_BYTES);
}

function getJsonBodySize(value: string) {
  return new TextEncoder().encode(value).length;
}

function rateLimitExceededResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many scheduler requests. Try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
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

  const userRateLimit = checkInMemoryRateLimit({
    key: `scheduler:solve:user:${userId}:production:${productionId}`,
    maxHits: getPositiveInteger(
      "SCHEDULER_SOLVE_RATE_LIMIT_PER_USER",
      DEFAULT_SOLVE_RATE_LIMIT
    ),
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!userRateLimit.allowed) {
    return rateLimitExceededResponse(userRateLimit.retryAfterSeconds);
  }

  const productionRateLimit = checkInMemoryRateLimit({
    key: `scheduler:solve:production:${productionId}`,
    maxHits: getPositiveInteger(
      "SCHEDULER_SOLVE_RATE_LIMIT_PER_PRODUCTION",
      DEFAULT_PRODUCTION_SOLVE_RATE_LIMIT
    ),
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!productionRateLimit.allowed) {
    return rateLimitExceededResponse(productionRateLimit.retryAfterSeconds);
  }

  const completeness = await getAvailabilityCompleteness(productionId);
  if (!completeness.isComplete) {
    return NextResponse.json(
      {
        error: "Conflict submissions are incomplete. Scheduling is blocked.",
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
  const bodySizeLimitBytes = getBodySizeLimitBytes();
  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > bodySizeLimitBytes
  ) {
    return NextResponse.json(
      { error: `Solver payload cannot be larger than ${bodySizeLimitBytes} bytes.` },
      { status: 413 }
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (getJsonBodySize(rawBody) > bodySizeLimitBytes) {
    return NextResponse.json(
      { error: `Solver payload cannot be larger than ${bodySizeLimitBytes} bytes.` },
      { status: 413 }
    );
  }

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "Solver payload must be a JSON object." },
      { status: 400 }
    );
  }

  const candidate = payload as {
    blocks?: Array<{ id?: unknown }>;
    precedences?: SolverPrecedence[];
    allowed_time_window?: unknown;
    time_zone?: unknown;
  };

  // Validate workload-related constraints before more expensive validations and upstream request
  const workloadErrors = validateSolverPayloadWorkload(
    candidate,
    getSolverPayloadLimits()
  );
  if (workloadErrors.length > 0) {
    return NextResponse.json(
      { error: workloadErrors.join(" ") },
      { status: 413 }
    );
  }

  // Normalisation of client input into strict internal format
  const { allowedTimeWindow, error: allowedTimeWindowError } =
    normalizeAllowedTimeWindowInput(candidate.allowed_time_window);

  if (!allowedTimeWindow || allowedTimeWindowError) {
    return NextResponse.json(
      { error: allowedTimeWindowError ?? "Invalid allowed_time_window." },
      { status: 400 }
    );
  }

  const { timeZone, error: timeZoneError } = normalizeSolverTimeZoneInput(
    candidate.time_zone
  );

  if (!timeZone || timeZoneError) {
    return NextResponse.json(
      { error: timeZoneError ?? "Invalid time_zone." },
      { status: 400 }
    );
  }

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

  const normalizedPayload = {
    ...candidate,
    allowed_time_window: allowedTimeWindow,
    time_zone: timeZone,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // External service call isolated behind API route with strict validation and normalisation
    const upstream = await fetch(`${config.baseUrl}/solve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify(normalizedPayload),
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
