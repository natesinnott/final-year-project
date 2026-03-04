import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessProductionScheduling } from "@/lib/scheduler-access";

const REQUEST_TIMEOUT_MS = 10_000;

function getProductionId(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("productionId")?.trim() ?? "";
}

function getSchedulerBaseUrl() {
  const baseUrl = process.env.SCHEDULER_BASE_URL?.trim();
  if (!baseUrl) {
    return null;
  }
  return baseUrl.replace(/\/$/, "");
}

export async function GET(request: Request) {
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

  const baseUrl = getSchedulerBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Scheduler is not configured" },
      { status: 500 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${baseUrl}/health`, {
      method: "GET",
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
          error: "Scheduler health endpoint returned non-JSON response",
          upstreamStatus: upstream.status,
          upstreamBody: rawBody.slice(0, 2000),
        },
        { status: upstream.status }
      );
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: `Scheduler health check timed out after ${REQUEST_TIMEOUT_MS}ms` },
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
