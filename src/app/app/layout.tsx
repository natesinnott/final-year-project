import DashboardShortcut from "./dashboard-shortcut";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <DashboardShortcut />
      {children}
    </>
  );
}
