"use client";

import { useMemo, useState } from "react";

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];

type ProductionSettingsFormProps = {
  production: {
    id: string;
    name: string;
    description: string | null;
    rehearsalStart: string | null;
    rehearsalEnd: string | null;
    venue: string | null;
    directorRoles: string[];
  };
  productionRoles: string[];
};

function formatDate(date: string | null) {
  if (!date) return "";
  const iso = new Date(date).toISOString();
  return iso.slice(0, 10);
}

export default function ProductionSettingsForm({
  production,
  productionRoles,
}: ProductionSettingsFormProps) {
  const initialDirectorRoles = useMemo(() => {
    return production.directorRoles.length > 0
      ? production.directorRoles
      : DEFAULT_DIRECTOR_ROLES;
  }, [production.directorRoles]);

  const [formState, setFormState] = useState({
    name: production.name,
    description: production.description ?? "",
    rehearsalStart: formatDate(production.rehearsalStart),
    rehearsalEnd: formatDate(production.rehearsalEnd),
    venue: production.venue ?? "",
    directorRoles: initialDirectorRoles,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleRole(role: string) {
    setFormState((prev) => {
      const next = new Set(prev.directorRoles);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return { ...prev, directorRoles: Array.from(next) };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/productions/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productionId: production.id,
          name: formState.name,
          description: formState.description,
          rehearsalStart: formState.rehearsalStart || null,
          rehearsalEnd: formState.rehearsalEnd || null,
          venue: formState.venue,
          directorRoles: formState.directorRoles,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to update production.");
      }

      setMessage("Production settings saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm"
    >
      <div className="grid gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Production name
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            value={formState.name}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, name: event.target.value }))
            }
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Rehearsal start
            </label>
            <input
              type="date"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              value={formState.rehearsalStart}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  rehearsalStart: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Rehearsal end
            </label>
            <input
              type="date"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              value={formState.rehearsalEnd}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  rehearsalEnd: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Venue
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            value={formState.venue}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, venue: event.target.value }))
            }
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Production summary
          </label>
          <textarea
            className="mt-2 min-h-[140px] w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            value={formState.description}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Director roles
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Users with these roles can manage production settings and send
            invites.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {productionRoles.map((role) => (
              <label
                key={role}
                className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={formState.directorRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {role.replace(/_/g, " ")}
              </label>
            ))}
          </div>
        </div>

        {message ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            {message}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 hover:border-slate-500"
            onClick={() => setFormState({
              name: production.name,
              description: production.description ?? "",
              rehearsalStart: formatDate(production.rehearsalStart),
              rehearsalEnd: formatDate(production.rehearsalEnd),
              venue: production.venue ?? "",
              directorRoles: initialDirectorRoles,
            })}
          >
            Reset
          </button>
        </div>
      </div>
    </form>
  );
}
