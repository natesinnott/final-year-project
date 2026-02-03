"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AnnouncementComposerProps = {
  organisationId: string;
  productionId: string;
  productionRoles: string[];
  canPost: boolean;
};

// Client-only form to create announcements scoped to a production.
export default function AnnouncementComposer({
  organisationId,
  productionId,
  productionRoles,
  canPost,
}: AnnouncementComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role)
        ? prev.filter((entry) => entry !== role)
        : [...prev, role]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPost) return;
    setIsSubmitting(true);
    setMessage(null);

    try {
      // Persist announcement via API and refresh server data on success.
      const response = await fetch("/api/announcements/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body,
          organisationId,
          productionId,
          visibleToRoles: selectedRoles,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to post announcement.");
      }

      setTitle("");
      setBody("");
      setSelectedRoles([]);
      setMessage("Announcement posted.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Title
        </label>
        <input
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Rehearsal moved to Studio B"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          disabled={!canPost}
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Message
        </label>
        <textarea
          className="mt-2 min-h-30 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Share the details here."
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          disabled={!canPost}
        />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Visible to
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {productionRoles.map((role) => (
            <label
              key={role}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300"
            >
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
                disabled={!canPost}
              />
              {role.replace(/_/g, " ")}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Leave empty to broadcast to the whole production.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        disabled={!canPost || isSubmitting}
      >
        {isSubmitting ? "Posting…" : "Post announcement"}
      </button>
      {!canPost ? (
        <p className="text-xs text-slate-500">
          Only directors and stage managers can post announcements.
        </p>
      ) : null}
    </form>
  );
}
