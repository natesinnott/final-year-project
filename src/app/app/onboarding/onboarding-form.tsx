"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  userName: string;
};

// Creates a new organisation and assigns the current user as admin.
export default function OnboardingForm({ userName }: Props) {
  const router = useRouter();
  const [formState, setFormState] = useState({
    name: "",
    primaryLocation: "",
    contactEmail: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Create org + admin membership, then route to org details.
      const response = await fetch("/api/organisations/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error ?? "Unable to create organisation.");
      }

      router.push("/app/organisation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
        <div className="text-sm text-slate-300">
          Signed in as <span className="font-medium text-white">{userName || "user"}</span>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Organisation name
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="Westminster Players"
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
              Primary location
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="London, UK"
              value={formState.primaryLocation}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  primaryLocation: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Contact email
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="hello@theatre.org"
              type="email"
              value={formState.contactEmail}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  contactEmail: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Organisation summary
          </label>
          <textarea
            className="mt-2 min-h-30 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="Tell us about your theatre and your upcoming productions."
            value={formState.description}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-70"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating…" : "Create organisation"}
        </button>
      </div>
    </form>
  );
}
