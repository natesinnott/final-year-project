import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Under construction 🚧</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You’re signed in as{" "}
              <span className="font-medium text-foreground">
                {session.user?.email ?? "unknown"}
              </span>
              .
            </p>
          </div>
          <SignOutButton />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border p-4">
            <div className="font-medium">Availability</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Coming soon.
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="font-medium">Announcements</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Coming soon.
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="font-medium">Files</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Coming soon.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}