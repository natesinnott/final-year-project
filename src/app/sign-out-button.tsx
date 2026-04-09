"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
      onClick={async () => {
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => router.push("/login"),
          },
        });
      }}
    >
      Sign out
    </button>
  );
}
