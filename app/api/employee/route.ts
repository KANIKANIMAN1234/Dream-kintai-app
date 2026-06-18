import { NextResponse } from "next/server";
import { findDemoEmployee, isDemoModeEnabled } from "@/lib/demoEmployees";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ApiError, EmployeeAuthSuccess } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  name: string;
  employee_code_4: string;
  is_active: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { code4?: string };
    const code4 = body.code4?.trim() ?? "";

    if (!/^[0-9]{4}$/.test(code4)) {
      return NextResponse.json<ApiError>(
        { ok: false, message: "社員コードは4桁の数字で入力してください。" },
        { status: 400 },
      );
    }

    if (isDemoModeEnabled()) {
      const demo = findDemoEmployee(code4);
      if (demo) {
        const response: EmployeeAuthSuccess = {
          ok: true,
          employee: {
            id: demo.id,
            name: demo.name,
            employee_code_4: demo.code4,
          },
          todayLogs: demo.todayLogs,
        };
        return NextResponse.json(response);
      }
    }

    const { data: employees, error } = await supabaseAdmin
      .from("m_employees")
      .select("id,tenant_id,name,employee_code_4,is_active")
      .eq("employee_code_4", code4)
      .eq("is_active", true)
      .limit(2);

    if (error) {
      return NextResponse.json<ApiError>(
        { ok: false, message: `社員照会に失敗しました: ${error.message}` },
        { status: 500 },
      );
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json<ApiError>(
        { ok: false, message: "社員コードを確認してください。" },
        { status: 401 },
      );
    }
    if (employees.length > 1) {
      return NextResponse.json<ApiError>(
        { ok: false, message: "複数テナントで社員コードが重複しています。管理者へ連絡してください。" },
        { status: 409 },
      );
    }
    const employee = employees[0] as EmployeeRow;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { data: logs, error: logsError } = await supabaseAdmin
      .from("t_attendance_logs")
      .select("id,event_type,occurred_at")
      .eq("tenant_id", employee.tenant_id)
      .eq("employee_id", employee.id)
      .gte("occurred_at", start)
      .order("occurred_at", { ascending: true });

    if (logsError) {
      return NextResponse.json<ApiError>(
        { ok: false, message: `本日打刻履歴の取得に失敗しました: ${logsError.message}` },
        { status: 500 },
      );
    }

    const response: EmployeeAuthSuccess = {
      ok: true,
      employee: {
        id: employee.id,
        name: employee.name,
        employee_code_4: employee.employee_code_4,
      },
      todayLogs:
        logs?.map((log) => ({
          id: log.id as string,
          event_type: log.event_type as "start" | "end" | "out" | "work",
          occurred_at: log.occurred_at as string,
        })) ?? [],
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json<ApiError>({ ok: false, message }, { status: 500 });
  }
}
