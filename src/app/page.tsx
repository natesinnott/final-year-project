const features = [
  {
    title: "Smart rehearsal planning",
    description:
      "AI-assisted scheduling balances availability, scenes, and space so everyone shows up prepared.",
  },
  {
    title: "Role-based collaboration",
    description:
      "Directors, stage managers, cast, and crew each get the tools they need without the noise.",
  },
  {
    title: "Files and announcements",
    description:
      "Upload choreography, music, and blocking with controlled access and instant updates.",
  },
  {
    title: "Attendance and availability",
    description:
      "Track absences, manage call sheets, and keep attendance frictionless for everyone.",
  },
];

const workflow = [
  {
    title: "Create your organisation",
    description: "Set up your theatre and invite your core team.",
  },
  {
    title: "Plan rehearsals",
    description: "Generate schedules that respect real availability.",
  },
  {
    title: "Share materials",
    description: "Distribute choreography, music, and blocking files safely.",
  },
  {
    title: "Stay aligned",
    description: "Announcements and updates reach the right people instantly.",
  },
];

const stats = [
  { label: "Avg. schedule build", value: "<30 min" },
  { label: "Teams onboarded", value: "4x faster" },
  { label: "Rehearsals tracked", value: "98% coverage" },
];

export const metadata = {
  title: "StageSuite | Production management for theatres",
};

export default function MarketingPage() {
  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 font-sans antialiased">
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 right-0 h-120 w-120 rounded-full bg-linear-to-br from-amber-400/30 via-orange-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute left-0 top-1/3 h-130 w-130 rounded-full bg-linear-to-br from-sky-500/20 via-emerald-500/5 to-transparent blur-3xl" />
        </div>

        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          <header className="flex items-center justify-between gap-4">
            <div className="text-sm font-semibold tracking-tight text-white">
              StageSuite
            </div>
            <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 sm:flex">
              <a className="hover:text-white" href="#features">
                Features
              </a>
              <a className="hover:text-white" href="#workflow">
                Workflow
              </a>
              <a className="hover:text-white" href="#pricing">
                Pricing
              </a>
              <a
                className="rounded-full border border-amber-300/60 bg-amber-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200 hover:border-amber-200 hover:bg-amber-300/20"
                href="/login"
              >
                Sign in
              </a>
            </nav>
            <div className="flex items-center gap-2 sm:hidden">
              <a
                className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500"
                href="#features"
              >
                Features
              </a>
              <a
                className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500"
                href="#pricing"
              >
                Pricing
              </a>
              <a
                className="rounded-full bg-amber-300 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-200"
                href="/login"
              >
                Sign in
              </a>
            </div>
          </header>

          <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="flex flex-col gap-7">
              <div>
                <p className="text-xs font-semibold tracking-wide text-amber-300">
                  Production management for small theatres
                </p>
                <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Rehearsals that run on time, not on chaos.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  StageSuite keeps schedules, announcements, and files in one
                  place so every role can stay focused on the show.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <a
                  className="inline-flex items-center justify-center rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-amber-200 sm:w-auto"
                  href="/login"
                >
                  Create your organisation
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 sm:w-auto"
                  href="#workflow"
                >
                  See the workflow
                </a>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 backdrop-blur"
                  >
                    <div className="text-2xl font-semibold text-white">
                      {stat.value}
                    </div>
                    <div className="text-xs text-slate-400">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-5 shadow-2xl backdrop-blur sm:p-6">
              <div className="flex items-center justify-between text-xs font-medium tracking-wide text-slate-400">
                <span>Live rehearsal board</span>
                <span>Tonight</span>
              </div>
              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
                  <div className="text-sm font-semibold text-white">
                    Act 1: Scene 3
                  </div>
                  <div className="text-xs text-slate-400">
                    6:00pm · Studio A · 14 cast
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
                  <div className="text-sm font-semibold text-white">
                    New choreography shared
                  </div>
                  <div className="text-xs text-slate-400">
                    3 files · 2 roles notified
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
                  <div className="text-sm font-semibold text-white">
                    Availability update
                  </div>
                  <div className="text-xs text-slate-400">
                    4 cast · 1 crew pending
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-3 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Announcements delivered</span>
                  <span className="text-slate-200">96%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Files accessed this week</span>
                  <span className="text-slate-200">128</span>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="grid gap-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-amber-300">
                  Built for ensembles
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-white">
                  Everything your production needs, in one place.
                </h2>
              </div>
              <div className="text-sm text-slate-300">
                Scheduling, announcements, attendance, and files.
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-5 backdrop-blur"
                >
                  <div className="text-lg font-semibold text-white">
                    {feature.title}
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    {feature.description}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            id="workflow"
            className="grid gap-8 rounded-3xl border border-slate-800/70 bg-slate-900/50 p-6 backdrop-blur sm:p-8 lg:grid-cols-[1fr_1.2fr]"
          >
            <div>
              <p className="text-xs font-semibold tracking-wide text-amber-300">
                Workflow
              </p>
              <h3 className="mt-3 text-3xl font-semibold text-white">
                A calm, role-aware dashboard.
              </h3>
              <p className="mt-4 text-sm text-slate-300">
                Directors build schedules, stage managers publish call sheets,
                and cast receive updates instantly. Every action is tracked with
                clear permissions per organisation.
              </p>
              <a
                className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-xs font-semibold tracking-wide text-slate-950 hover:bg-slate-200"
                href="/login"
              >
                Get started
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {workflow.map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"
                >
                  <div className="text-sm font-semibold text-white">
                    {step.title}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {step.description}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            id="pricing"
            className="grid gap-6 rounded-3xl border border-slate-800/70 bg-slate-900/50 p-6 backdrop-blur sm:p-8 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div>
              <p className="text-xs font-semibold tracking-wide text-amber-300">
                Pricing
              </p>
              <h3 className="mt-3 text-3xl font-semibold text-white">
                Built for small theatre budgets.
              </h3>
              <p className="mt-4 text-sm text-slate-300">
                Start with an early access plan tailored for student productions
                and local theatre groups. Scale when your season grows.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5 sm:p-6">
              <div className="text-xs font-medium tracking-wide text-slate-400">
                Early access
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">
                £0
                <span className="text-base font-medium text-slate-400">
                  /production
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-300">
                We are onboarding our first theatres now. Lock in concierge
                setup and priority feedback.
              </div>
              <a
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-amber-300 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-200"
                href="/login"
              >
                Claim your slot
              </a>
            </div>
          </section>

          <footer className="flex flex-col gap-2 border-t border-slate-800/70 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>StageSuite · Final Year Project</div>
            <div>Secure, role-based rehearsal management.</div>
          </footer>
        </div>
      </div>
    </main>
  );
}
