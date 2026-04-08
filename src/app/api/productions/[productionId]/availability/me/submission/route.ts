import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAvailabilityAccessContext } from "@/lib/availability-access";
import { markConflictsSubmitted } from "@/lib/availability";

type RouteParams = {
  params: Promise<{ productionId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
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

  if (!access.isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submittedAt = await markConflictsSubmitted({
    productionId,
    userId,
  });

  return NextResponse.json({
    ok: true,
    submittedAt: submittedAt.toISOString(),
  });
}
