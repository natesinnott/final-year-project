import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessProductionScheduling } from "@/lib/scheduler-access";
import { normalizeSchedulingDraftState } from "@/lib/scheduling-draft";
import {
  deleteSchedulingDraftState,
  upsertSchedulingDraftState,
} from "@/lib/scheduling-draft-store";

type RouteParams = {
  params: Promise<{ productionId: string }>;
};

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId } = await params;
  const canAccess = await canAccessProductionScheduling(userId, productionId);

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const draft = normalizeSchedulingDraftState(payload);
  if (!draft) {
    return NextResponse.json(
      { error: "Invalid scheduling draft payload." },
      { status: 400 }
    );
  }

  try {
    const saved = await upsertSchedulingDraftState({
      productionId,
      userId,
      draft,
    });

    return NextResponse.json({
      updatedAt: saved.updatedAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save scheduling draft.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId } = await params;
  const canAccess = await canAccessProductionScheduling(userId, productionId);

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteSchedulingDraftState({
      productionId,
      userId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete scheduling draft.",
      },
      { status: 500 }
    );
  }
}
