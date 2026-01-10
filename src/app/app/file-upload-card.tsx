"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FileUploadCardProps = {
  organisationId: string;
  productionId: string;
  productionRoles: string[];
};

export default function FileUploadCard({
  organisationId,
  productionId,
  productionRoles,
}: FileUploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
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
    if (!file) {
      setMessage("Select a file to upload.");
      return;
    }
    setIsSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("organisationId", organisationId);
      formData.append("productionId", productionId);
      if (selectedRoles.length > 0) {
        formData.append("visibleToRoles", selectedRoles.join(","));
      }

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to upload file.");
      }

      setFile(null);
      setSelectedRoles([]);
      setMessage("File uploaded.");
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
          Upload file
        </label>
        <input
          type="file"
          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-200"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
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
        <p className="mt-2 text-xs text-slate-500">
          Leave empty to make the file visible to the whole production.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Uploading…" : "Upload file"}
      </button>
    </form>
  );
}
