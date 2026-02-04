import { redirect } from "next/navigation";

export const metadata = {
  title: "StageSuite | Organisation settings",
};

export default async function OrganisationPage() {
  redirect("/app/organisation/settings");
}
