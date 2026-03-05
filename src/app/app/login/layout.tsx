import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StageSuite | Sign in",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
