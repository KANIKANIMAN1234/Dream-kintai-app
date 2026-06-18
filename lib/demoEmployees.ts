import type { AttendanceLog } from "@/lib/types";

export type DemoEmployee = {
  id: string;
  name: string;
  code4: string;
  todayLogs: AttendanceLog[];
};

export function isDemoModeEnabled() {
  if (process.env.NEXT_PUBLIC_FORCE_PRODUCTION === "true") return false;
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_SCOPE === "attendance";
}

export function isDemoEmployeeId(employeeId: string) {
  return employeeId.startsWith("demo-emp-");
}

export const storeOptions = [
  { id: "sayama", label: "本社（狭山）" },
  { id: "musashino", label: "武蔵" },
] as const;

export function findDemoEmployee(code4: string): DemoEmployee | null {
  const now = new Date();
  const at = (hour: number, minute: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0).toISOString();

  const map: Record<string, DemoEmployee> = {
    "1001": {
      id: "demo-emp-001",
      name: "田中 一郎",
      code4: "1001",
      todayLogs: [
        { id: "demo-log-1", event_type: "start", occurred_at: at(8, 47) },
        { id: "demo-log-2", event_type: "out", occurred_at: at(12, 0) },
        { id: "demo-log-3", event_type: "work", occurred_at: at(13, 0) },
      ],
    },
    "1002": {
      id: "demo-emp-002",
      name: "鈴木 花子",
      code4: "1002",
      todayLogs: [{ id: "demo-log-4", event_type: "start", occurred_at: at(9, 0) }],
    },
    "1003": {
      id: "demo-emp-003",
      name: "佐藤 次郎",
      code4: "1003",
      todayLogs: [],
    },
  };
  return map[code4] ?? null;
}
