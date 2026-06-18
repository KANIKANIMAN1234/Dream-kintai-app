import { NextResponse } from "next/server";
import { isDemoEmployeeId, isDemoModeEnabled } from "@/lib/demoEmployees";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ApiError, AttendanceEventType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventTypeSet = new Set<AttendanceEventType>(["start", "end", "out", "work"]);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      employeeId?: string;
      eventType?: AttendanceEventType;
      terminalId?: string;
      location?: {
        latitude?: number;
        longitude?: number;
        accuracy_m?: number;
        captured_at?: string;
      };
    };
    const employeeId = body.employeeId?.trim() ?? "";
    const eventType = body.eventType;
    const terminalId = body.terminalId?.trim() || "web-terminal";

    if (!employeeId) {
      return NextResponse.json<ApiError>(
        { ok: false, message: "employeeId が必要です。" },
        { status: 400 },
      );
    }

    if (!eventType || !eventTypeSet.has(eventType)) {
      return NextResponse.json<ApiError>(
        { ok: false, message: "eventType が不正です。" },
        { status: 400 },
      );
    }

    const { data: employeeRow, error: employeeError } = await supabaseAdmin
      .from("m_employees")
      .select("id,tenant_id")
      .eq("id", employeeId)
      .single();

    if (!employeeError && employeeRow) {
      const occurredAt = new Date().toISOString();
      const location = body.location;
      const hasLocation =
        typeof location?.latitude === "number" &&
        typeof location?.longitude === "number" &&
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude);

      const { data, error } = await supabaseAdmin
        .from("t_attendance_logs")
        .insert({
          tenant_id: employeeRow.tenant_id,
          employee_id: employeeId,
          event_type: eventType,
          occurred_at: occurredAt,
          input_channel: "terminal_only",
          terminal_id: terminalId,
          ...(hasLocation
            ? {
                location_latitude: location.latitude,
                location_longitude: location.longitude,
                location_accuracy_m:
                  typeof location.accuracy_m === "number" ? location.accuracy_m : null,
                location_captured_at: location.captured_at ?? occurredAt,
                location_source: "gps",
              }
            : {}),
        })
        .select("id,event_type,occurred_at")
        .single();

      if (error) {
        return NextResponse.json<ApiError>(
          { ok: false, message: `打刻登録に失敗しました: ${error.message}` },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        log: data,
      });
    }

    if (isDemoModeEnabled() && isDemoEmployeeId(employeeId)) {
      const occurredAt = new Date().toISOString();
      return NextResponse.json({
        ok: true,
        log: {
          id: `demo-log-${Date.now()}`,
          event_type: eventType,
          occurred_at: occurredAt,
        },
      });
    }

    return NextResponse.json<ApiError>(
      { ok: false, message: "従業員情報の取得に失敗しました。" },
      { status: employeeError ? 500 : 404 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json<ApiError>({ ok: false, message }, { status: 500 });
  }
}
