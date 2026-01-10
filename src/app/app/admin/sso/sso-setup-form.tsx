"use client";

import { useEffect, useState } from "react";

type Provider = "ENTRA" | "OKTA" | "GOOGLE_WORKSPACE";

type FormState = {
  provider: Provider;
  clientId: string;
  clientSecret: string;
  issuer: string;
  tenantId: string;
  domains: string;
  enabled: boolean;
};

const defaultState: FormState = {
  provider: "ENTRA",
  clientId: "",
  clientSecret: "",
  issuer: "",
  tenantId: "",
  domains: "",
  enabled: true,
};

export default function SsoSetupForm() {
  const [formState, setFormState] = useState<FormState>(defaultState);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchConfig() {
      try {
        const response = await fetch("/api/sso/config");
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (!payload?.ssoConfig || !isMounted) {
          return;
        }
        setFormState((prev) => ({
          ...prev,
          provider: payload.ssoConfig.provider,
          clientId: payload.ssoConfig.clientId ?? "",
          clientSecret: payload.ssoConfig.clientSecret ?? "",
          issuer: payload.ssoConfig.issuer ?? "",
          tenantId: payload.ssoConfig.tenantId ?? "",
          enabled: payload.ssoConfig.enabled ?? true,
          domains: Array.isArray(payload.domains)
            ? payload.domains.join(", ")
            : "",
        }));
      } catch {
        // ignore load failures
      }
    }
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/sso/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: formState.provider,
          clientId: formState.clientId,
          clientSecret: formState.clientSecret,
          issuer: formState.issuer || undefined,
          tenantId: formState.tenantId || undefined,
          enabled: formState.enabled,
          domains: formState.domains
            .split(",")
            .map((domain) => domain.trim())
            .filter(Boolean),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to save SSO configuration.");
      }

      setMessage("SSO configuration saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
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
            Provider
          </label>
          <select
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            value={formState.provider}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                provider: event.target.value as Provider,
              }))
            }
          >
            <option value="ENTRA">Microsoft Entra ID</option>
            <option value="OKTA">Okta</option>
            <option value="GOOGLE_WORKSPACE">Google Workspace</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Client ID
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            value={formState.clientId}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                clientId: event.target.value,
              }))
            }
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Client Secret
          </label>
          <input
            type="password"
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            value={formState.clientSecret}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                clientSecret: event.target.value,
              }))
            }
            required
          />
        </div>

        {formState.provider === "OKTA" ? (
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Okta issuer URL
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="https://dev-123456.okta.com/oauth2/default"
              value={formState.issuer}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  issuer: event.target.value,
                }))
              }
              required
            />
          </div>
        ) : null}

        {formState.provider === "ENTRA" ? (
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Entra tenant ID
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="common or tenant GUID"
              value={formState.tenantId}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  tenantId: event.target.value,
                }))
              }
              required
            />
          </div>
        ) : null}

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Organisation domains
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="example.com, another.org"
            value={formState.domains}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                domains: event.target.value,
              }))
            }
            required
          />
          <p className="mt-2 text-xs text-slate-500">
            Comma-separated list of email domains routed to this provider.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={formState.enabled}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                enabled: event.target.checked,
              }))
            }
          />
          Enable SSO routing
        </label>

        {message ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-70"
        >
          {isLoading ? "Saving…" : "Save configuration"}
        </button>
      </div>
    </form>
  );
}
