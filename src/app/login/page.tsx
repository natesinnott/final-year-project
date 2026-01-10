import { redirect } from "next/navigation";

export const metadata = {
  title: "StageSuite | Sign in",
};

export default function LoginRedirectPage() {
  redirect("/app/login");
}
