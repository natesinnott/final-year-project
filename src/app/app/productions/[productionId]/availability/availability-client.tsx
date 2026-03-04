"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AvailabilityWindowRow = {
  id: string;
  start: string;
  end: string;
  kind: "AVAILABLE" | "UNAVAILABLE";
};

type AvailabilityClientProps = {
  productionId: string;
};

type FormState = {
  start: string;
  end: string;
  kind: "AVAILABLE" | "UNAVAILABLE";
};

const DEFAULT_FORM: FormState = {
  start: "",
  end: "",
  kind: "AVAILABLE",
};

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoFromInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function prettyDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.toLocaleString()} (UTC: ${iso})`;
}

export default function AvailabilityClient({ productionId }: AvailabilityClientProps) {
  const [windows, setWindows] = useState<AvailabilityWindowRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const editingWindow = useMemo(
    () => windows.find((window) => window.id === editingWindowId) ?? null,
    [windows, editingWindowId]
  );

  const loadWindows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/availability/me`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as {
        error?: string;
        windows?: AvailabilityWindowRow[];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load availability.");
      }

      setWindows(payload.windows ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Request failed.");
    } finally {
      setIsLoading(false);
    }
  }, [productionId]);

  useEffect(() => {
    loadWindows();
  }, [loadWindows]);

  function openCreateModal() {
    setEditingWindowId(null);
    setForm(DEFAULT_FORM);
    setError(null);
    setMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(window: AvailabilityWindowRow) {
    setEditingWindowId(window.id);
    setForm({
      start: toLocalInputValue(window.start),
      end: toLocalInputValue(window.end),
      kind: window.kind,
    });
    setError(null);
    setMessage(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingWindowId(null);
    setForm(DEFAULT_FORM);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const startIso = toIsoFromInput(form.start);
      const endIso = toIsoFromInput(form.end);

      if (!startIso || !endIso) {
        throw new Error("Start and end must be valid dates.");
      }

      const endpoint = editingWindowId
        ? `/api/productions/${encodeURIComponent(productionId)}/availability/me/${encodeURIComponent(editingWindowId)}`
        : `/api/productions/${encodeURIComponent(productionId)}/availability/me`;

      const method = editingWindowId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start: startIso,
          end: endIso,
          kind: form.kind,
        }),
      });

      const payload = (await response.json()) as AvailabilityWindowRow & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save availability window.");
      }

      if (editingWindowId) {
        setWindows((prev) =>
          prev.map((window) => (window.id === payload.id ? payload : window))
        );
        setMessage("Availability window updated.");
      } else {
        setWindows((prev) =>
          [...prev, payload].sort((a, b) => a.start.localeCompare(b.start))
        );
        setMessage("Availability window added.");
      }

      closeModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Request failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(windowId: string) {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/availability/me/${encodeURIComponent(windowId)}`,
        {
          method: "DELETE",
        }
      );

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete availability window.");
      }

      setWindows((prev) => prev.filter((window) => window.id !== windowId));
      setMessage("Availability window deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Request failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Your windows
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Manage your availability
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Add available/unavailable windows. Overlapping windows are rejected.
          </p>
        </div>
        <button
          className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
          onClick={openCreateModal}
          disabled={isLoading || isSaving}
        >
          Add window
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
        <div className="grid grid-cols-[1.4fr_1.4fr_0.8fr_0.8fr] gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <div>Start</div>
          <div>End</div>
          <div>Kind</div>
          <div>Actions</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-3 text-sm text-slate-300">Loading availability...</div>
        ) : windows.length === 0 ? (
          <div className="px-4 py-3 text-sm text-slate-300">
            No windows submitted yet.
          </div>
        ) : (
          windows.map((window) => (
            <div
              key={window.id}
              className="grid grid-cols-[1.4fr_1.4fr_0.8fr_0.8fr] gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-200"
            >
              <div>{prettyDate(window.start)}</div>
              <div>{prettyDate(window.end)}</div>
              <div>{window.kind}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
                  onClick={() => openEditModal(window)}
                  disabled={isSaving}
                >
                  Edit
                </button>
                <button
                  className="rounded-lg border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:border-rose-400 disabled:opacity-60"
                  onClick={() => handleDelete(window.id)}
                  disabled={isSaving}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form
            className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
            onSubmit={handleSubmit}
          >
            <h3 className="text-lg font-semibold text-white">
              {editingWindow ? "Edit availability window" : "Add availability window"}
            </h3>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm text-slate-300">
                Start
                <input
                  type="datetime-local"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                  value={form.start}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, start: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                End
                <input
                  type="datetime-local"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                  value={form.end}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, end: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                Kind
                <select
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                  value={form.kind}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      kind: event.target.value as "AVAILABLE" | "UNAVAILABLE",
                    }))
                  }
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="UNAVAILABLE">UNAVAILABLE</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                onClick={closeModal}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : editingWindow ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
