import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAvailabilityAccessContext } from "@/lib/availability-access";
import { getTeamAvailabilitySnapshot } from "@/lib/availability";

type RouteParams = {
  params: Promise<{ productionId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId } = await params;
  const access = await getAvailabilityAccessContext(userId, productionId);

  if (!access) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  if (!access.isDirectorRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await getTeamAvailabilitySnapshot(productionId);

  return NextResponse.json({
    members: snapshot.members,
    completeness: {
      is_complete: snapshot.completeness.isComplete,
      total_members: snapshot.completeness.totalMembers,
      required_members: snapshot.completeness.requiredMembers,
      submitted_members: snapshot.completeness.submittedMembers,
      missing_members: snapshot.completeness.missingMembers,
    },
  });
}
