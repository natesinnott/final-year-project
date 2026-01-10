"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  organisationName: string;
};

// Creates a production and assigns the creator as director.
export default function ProductionSetupForm({ organisationName }: Props) {
  const router = useRouter();
  const [formState, setFormState] = useState({
    name: "",
    venue: "",
    rehearsalStart: "",
    rehearsalEnd: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      // Server validates admin role and creates production + membership.
      const response = await fetch("/api/productions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to create production.");
      }
      setMessage("Production created. Redirecting to your dashboard…");
      router.push("/app");
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
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-slate-300">
          Setting up production for{" "}
          <span className="font-semibold text-white">
            {organisationName}
          </span>
          .
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Production name
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="Spring Showcase"
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
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="Main Stage"
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
            className="mt-2 min-h-[140px] w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="Describe the production, creative goals, or special notes."
            value={formState.description}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
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
            {isSubmitting ? "Creating…" : "Create production"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 hover:border-slate-500"
            onClick={() => router.push("/app/productions")}
          >
            Back to productions
          </button>
        </div>
      </div>
    </form>
  );
}
