export type AttendanceEventType = "start" | "end" | "out" | "work";

export type AttendanceLog = {
  id: string;
  event_type: AttendanceEventType;
  occurred_at: string;
};

export type EmployeeAuthSuccess = {
  ok: true;
  employee: {
    id: string;
    name: string;
    employee_code_4: string;
  };
  todayLogs: AttendanceLog[];
};

export type ApiError = {
  ok: false;
  message: string;
};
