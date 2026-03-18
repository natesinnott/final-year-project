import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { staffClearAttendance, staffMarkNoShow } from "@/lib/attendance";
import { getAttendanceAccessContext } from "@/lib/attendance-access";

type RouteParams = {
  params: Promise<{ productionId: string; rehearsalId: string; userId: string }>;
};

type StaffAttendancePayload = {
  action?: string;
};

const STAFF_ATTENDANCE_ACTIONS = new Set(["MARK_NO_SHOW", "CLEAR_TO_PRESENT"]);

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const actorUserId = session?.user?.id;

  if (!actorUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId, rehearsalId, userId } = await params;
  const access = await getAttendanceAccessContext(actorUserId, productionId);

  if (!access) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  if (!access.canManageAttendance) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: StaffAttendancePayload;
  try {
    payload = (await request.json()) as StaffAttendancePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = payload.action?.trim();

  if (!action || !STAFF_ATTENDANCE_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: "Choose a valid attendance action." },
      { status: 400 }
    );
  }

  const result =
    action === "MARK_NO_SHOW"
      ? await staffMarkNoShow({
          productionId,
          rehearsalId,
          subjectUserId: userId,
          actorUserId,
        })
      : await staffClearAttendance({
          productionId,
          rehearsalId,
          subjectUserId: userId,
          actorUserId,
        });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    status: result.attendance?.status ?? "PRESENT",
    note: result.attendance?.note ?? null,
  });
}
