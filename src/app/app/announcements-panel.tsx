"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserDateTime } from "@/lib/useBrowserDateTime";

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdByName: string | null;
};

type AnnouncementsPanelProps = {
  organisationId: string;
  productionId: string;
  productionRoles: string[];
  canPost: boolean;
  announcements: AnnouncementItem[];
};

export default function AnnouncementsPanel({
  organisationId,
  productionId,
  productionRoles,
  canPost,
  announcements,
}: AnnouncementsPanelProps) {
  const dateTime = useBrowserDateTime();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
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
      setIsComposerOpen(false);
      setMessage(null);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Announcements</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Live data</span>
          {canPost ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setIsComposerOpen((current) => !current);
              }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
            >
              {isComposerOpen ? "Cancel" : "+ New announcement"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {announcements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-sm text-slate-400">
            No announcements
          </div>
        ) : (
          announcements.map((announcement) => (
            <article
              key={announcement.id}
              className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4"
            >
              <div className="font-medium text-white">{announcement.title}</div>
              <div className="mt-2 text-sm text-slate-300">{announcement.body}</div>
              <div className="mt-2 text-xs text-slate-500">
                {dateTime.formatBrowserZoneInstant(announcement.createdAt)}
                {announcement.createdByName ? ` · ${announcement.createdByName}` : ""}
              </div>
            </article>
          ))
        )}
      </div>

      {canPost && isComposerOpen ? (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4">
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
                  />
                  {role.replace(/_/g, " ")}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Leave empty to send to everyone.
            </p>
          </div>

          {message ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-fit rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Posting..." : "Post announcement"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
