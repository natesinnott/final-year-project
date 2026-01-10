"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrganisationFormValues = {
  name: string;
  primaryLocation: string;
  contactEmail: string;
  description: string;
};

type Props = {
  initialValues: OrganisationFormValues;
};

// Updates organisation profile details via the API.
export default function OrganisationForm({ initialValues }: Props) {
  const router = useRouter();
  const [formState, setFormState] = useState(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      // Persist updates, then refresh server-rendered data.
      const response = await fetch("/api/organisations/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error ?? "Unable to update organisation.");
      }

      setMessage("Organisation details saved.");
      router.refresh();
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
            Organisation name
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
              Primary location
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
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
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
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
            {isSubmitting ? "Saving…" : "Save details"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 hover:border-slate-500"
            onClick={() => router.push("/app")}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    </form>
  );
}
