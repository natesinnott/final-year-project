"use client";

import { useEffect, useMemo, useState } from "react";

type ScheduleClientProps = {
  productionId: string;
  examplePayload: string;
};

type BlockPlacement = {
  block_id?: string;
  blockId?: string;
  start?: string;
  end?: string;
  room_id?: string | null;
  roomId?: string | null;
};

type SolveResult = {
  status?: string;
  placements?: BlockPlacement[];
  objective_value?: number | null;
};

const TERMINAL_JOB_STATES = new Set(["completed", "failed"]);
const SOLVER_RESULT_STATUSES = new Set([
  "OPTIMAL",
  "FEASIBLE",
  "INFEASIBLE",
  "TIME_LIMIT",
]);

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const candidate = payload as { error?: unknown; detail?: unknown };

    if (typeof candidate.error === "string" && candidate.error.length > 0) {
      return candidate.error;
    }

    if (typeof candidate.detail === "string" && candidate.detail.length > 0) {
      return candidate.detail;
    }

    if (candidate.detail) {
      return JSON.stringify(candidate.detail);
    }
  }

  return fallback;
}

function extractSolveResult(payload: unknown): SolveResult | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as {
    status?: unknown;
    placements?: unknown;
    result?: unknown;
  };

  if (
    typeof body.status === "string" &&
    SOLVER_RESULT_STATUSES.has(body.status) &&
    Array.isArray(body.placements)
  ) {
    return body as SolveResult;
  }

  if (!body.result || typeof body.result !== "object") {
    return null;
  }

  const result = body.result as {
    status?: unknown;
    placements?: unknown;
  };

  if (
    typeof result.status === "string" &&
    SOLVER_RESULT_STATUSES.has(result.status) &&
    Array.isArray(result.placements)
  ) {
    return result as SolveResult;
  }

  return null;
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

async function parseResponseJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function ScheduleClient({
  productionId,
  examplePayload,
}: ScheduleClientProps) {
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);

  const [payloadText, setPayloadText] = useState(examplePayload);
  const [isRunning, setIsRunning] = useState(false);

  const [lastHttpStatus, setLastHttpStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function checkHealth() {
      setHealthLoading(true);
      setHealthMessage(null);

      try {
        const response = await fetch(
          `/api/scheduler/health?productionId=${encodeURIComponent(productionId)}`,
          {
            cache: "no-store",
          }
        );

        const body = await parseResponseJson(response);

        if (!isActive) {
          return;
        }

        setHealthOk(response.ok);
        if (!response.ok) {
          setHealthMessage(getErrorMessage(body, "Health check failed."));
          return;
        }

        setHealthMessage(null);
      } catch {
        if (!isActive) {
          return;
        }

        setHealthOk(false);
        setHealthMessage("Unable to reach scheduler health endpoint.");
      } finally {
        if (isActive) {
          setHealthLoading(false);
        }
      }
    }

    checkHealth();

    return () => {
      isActive = false;
    };
  }, [productionId]);

  async function pollJobUntilComplete(currentJobId: string) {
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(
        `/api/scheduler/jobs/${encodeURIComponent(currentJobId)}?productionId=${encodeURIComponent(productionId)}`,
        {
          cache: "no-store",
        }
      );

      const body = await parseResponseJson(response);
      setLastHttpStatus(response.status);
      setLastResponse(body);

      if (!response.ok) {
        throw new Error(getErrorMessage(body, "Unable to retrieve solver job status."));
      }

      if (body && typeof body === "object") {
        const status = (body as { status?: unknown }).status;

        if (typeof status === "string") {
          setJobStatus(status);

          if (TERMINAL_JOB_STATES.has(status)) {
            if (status === "failed") {
              const error = getErrorMessage(body, "Scheduler job failed.");
              throw new Error(error);
            }

            const result = extractSolveResult(body);
            if (!result) {
              throw new Error("Scheduler finished without a valid result payload.");
            }

            setSolveResult(result);
            return;
          }
        }
      }

      await sleep(1000);
    }

    throw new Error("Solver job polling timed out.");
  }

  async function handleRunSolve() {
    setIsRunning(true);
    setErrorMessage(null);
    setLastHttpStatus(null);
    setLastResponse(null);
    setSolveResult(null);
    setJobId(null);
    setJobStatus(null);

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payloadText) as unknown;
    } catch {
      setErrorMessage("Payload is not valid JSON.");
      setIsRunning(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/scheduler/solve?productionId=${encodeURIComponent(productionId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(parsedPayload),
        }
      );

      const body = await parseResponseJson(response);
      setLastHttpStatus(response.status);
      setLastResponse(body);

      if (!response.ok) {
        setErrorMessage(getErrorMessage(body, "Solver request failed."));
        return;
      }

      const immediateResult = extractSolveResult(body);
      if (immediateResult) {
        setSolveResult(immediateResult);
        return;
      }

      if (body && typeof body === "object") {
        const solveBody = body as { job_id?: unknown; status?: unknown };

        if (typeof solveBody.job_id === "string" && solveBody.job_id.length > 0) {
          setJobId(solveBody.job_id);
          if (typeof solveBody.status === "string") {
            setJobStatus(solveBody.status);
          }
          await pollJobUntilComplete(solveBody.job_id);
          return;
        }
      }

      setErrorMessage("Solver response did not include a usable result.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected scheduling error."
      );
    } finally {
      setIsRunning(false);
    }
  }

  const placements = useMemo(() => solveResult?.placements ?? [], [solveResult]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Solver health
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Service status</h2>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              healthOk
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                : "border-rose-400/40 bg-rose-500/15 text-rose-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                healthOk ? "bg-emerald-300" : "bg-rose-300"
              }`}
            />
            {healthLoading ? "Checking" : healthOk ? "Healthy" : "Unhealthy"}
          </span>
        </div>
        {healthMessage ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            {healthMessage}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Solver run
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Execution status</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <p>
            Last HTTP status: <span className="text-white">{lastHttpStatus ?? "-"}</span>
          </p>
          <p>
            Job id: <span className="text-white">{jobId ?? "-"}</span>
          </p>
          <p>
            Job status: <span className="text-white">{jobStatus ?? "-"}</span>
          </p>
          <p>
            Solver status: <span className="text-white">{solveResult?.status ?? "-"}</span>
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Payload editor
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Placement problem JSON</h2>
        <textarea
          className="mt-4 h-80 w-full rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-sm text-slate-200 outline-none focus:border-amber-300"
          value={payloadText}
          onChange={(event) => setPayloadText(event.target.value)}
          spellCheck={false}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            onClick={handleRunSolve}
            disabled={isRunning}
          >
            {isRunning ? "Running..." : "Run Solve"}
          </button>
          {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Results
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Scheduled blocks</h2>

        {solveResult ? (
          <>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              Solver status: <span className="font-semibold text-white">{solveResult.status}</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
              <div className="grid grid-cols-4 gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <div>Block id</div>
                <div>Start</div>
                <div>End</div>
                <div>Room</div>
              </div>
              {placements.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-300">No placements returned.</div>
              ) : (
                placements.map((placement, index) => (
                  <div
                    key={`${placement.block_id ?? placement.blockId ?? index}`}
                    className="grid grid-cols-4 gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-200"
                  >
                    <div>{placement.block_id ?? placement.blockId ?? "-"}</div>
                    <div>{formatDateTime(placement.start)}</div>
                    <div>{formatDateTime(placement.end)}</div>
                    <div>{placement.room_id ?? placement.roomId ?? "-"}</div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400">
            No solver result yet.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm lg:col-span-2">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Raw solver response JSON
          </summary>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
            {JSON.stringify(lastResponse, null, 2)}
          </pre>
        </details>
      </section>
    </div>
  );
}
