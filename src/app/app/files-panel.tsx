"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type FileItem = {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  uploadedByName: string | null;
};

type FilesPanelProps = {
  organisationId: string;
  productionId: string;
  productionRoles: string[];
  canUpload: boolean;
  files: FileItem[];
};

export default function FilesPanel({
  organisationId,
  productionId,
  productionRoles,
  canUpload,
  files,
}: FilesPanelProps) {
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    if (!canUpload) return;

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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsUploaderOpen(false);
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
        <h2 className="text-lg font-semibold text-white">Files</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Live data</span>
          {canUpload ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setIsUploaderOpen((current) => !current);
              }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500"
            >
              {isUploaderOpen ? "Cancel" : "Upload"}
            </button>
          ) : null}
        </div>
      </div>

      {canUpload && isUploaderOpen ? (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              File
            </label>
            <input
              ref={fileInputRef}
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
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-fit rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Uploading..." : "Upload file"}
          </button>
        </form>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/30">
        <div className="grid grid-cols-[2fr_1.2fr_1fr_auto] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <span>File</span>
          <span>Uploaded</span>
          <span>By</span>
          <span className="text-right">Action</span>
        </div>

        {files.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">
            No files uploaded yet. Choreography, music, and blocking files will show up
            here.
          </div>
        ) : (
          files.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[2fr_1.2fr_1fr_auto] gap-3 border-b border-slate-800/70 px-4 py-3 text-sm text-slate-200 last:border-b-0"
            >
              <div>
                <div className="font-medium text-white">{item.originalName}</div>
                <div className="text-xs text-slate-500">
                  {Math.max(1, Math.round(item.size / 1024))} KB · {item.mimeType}
                </div>
              </div>
              <div className="text-xs text-slate-400">
                {new Date(item.createdAt).toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">{item.uploadedByName ?? "Unknown"}</div>
              <div className="text-right">
                <a
                  href={`/api/files/download?id=${item.id}`}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                >
                  Download
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
