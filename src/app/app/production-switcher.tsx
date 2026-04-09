"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type ProductionSwitcherProps = {
  currentProductionId: string;
  productions: Array<{
    id: string;
    name: string;
  }>;
};

export default function ProductionSwitcher({
  currentProductionId,
  productions,
}: ProductionSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(nextProductionId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("productionId", nextProductionId);

    startTransition(() => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="w-full sm:max-w-sm">
      <label
        htmlFor="dashboard-production"
        className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
      >
        View another production
      </label>
      <select
        id="dashboard-production"
        value={currentProductionId}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {productions.map((production) => (
          <option key={production.id} value={production.id}>
            {production.name}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-slate-400">
        {isPending ? "Opening production..." : "Selecting a production opens it immediately."}
      </p>
    </div>
  );
}
