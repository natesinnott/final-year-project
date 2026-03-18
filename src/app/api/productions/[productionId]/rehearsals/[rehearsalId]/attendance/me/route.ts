import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  clearSelfReportedAbsence,
  selfReportAbsence,
} from "@/lib/attendance";
import { getAttendanceAccessContext } from "@/lib/attendance-access";

type RouteParams = {
  params: Promise<{ productionId: string; rehearsalId: string }>;
};

type SelfReportPayload = {
  note?: string | null;
};

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId, rehearsalId } = await params;
  const access = await getAttendanceAccessContext(userId, productionId);

  if (!access) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  if (!access.isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: SelfReportPayload;
  try {
    payload = (await request.json()) as SelfReportPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await selfReportAbsence({
    productionId,
    rehearsalId,
    userId,
    note: payload.note ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    status: result.attendance.status,
    note: result.attendance.note,
    updated_at: result.attendance.updatedAt.toISOString(),
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId, rehearsalId } = await params;
  const access = await getAttendanceAccessContext(userId, productionId);

  if (!access) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  if (!access.isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await clearSelfReportedAbsence({
    productionId,
    rehearsalId,
    userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    status: result.attendance?.status ?? "PRESENT",
    note: result.attendance?.note ?? null,
  });
}
