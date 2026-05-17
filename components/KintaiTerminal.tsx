"use client";

import { useEffect, useMemo, useState } from "react";
import type { AttendanceEventType, AttendanceLog, ApiError, EmployeeAuthSuccess } from "@/lib/types";

type Screen = "idle" | "pin" | "action" | "confirm" | "done";

type EmployeeState = {
  id: string;
  name: string;
  code4: string;
};

const labelToEvent: Record<string, AttendanceEventType> = {
  出動: "start",
  退動: "end",
  外出: "out",
  業務: "work",
};

const eventToLabel: Record<AttendanceEventType, string> = {
  start: "出動",
  end: "退動",
  out: "外出",
  work: "業務",
};

const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"];

function formatDate(now: Date) {
  return now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function formatTime(now: Date) {
  return now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatHM(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTerminalIdentifier() {
  if (typeof window === "undefined") return "web-terminal";
  const key = "kintai_terminal_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const generated = `terminal-${window.location.hostname || "local"}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(key, generated);
  return generated;
}

export function KintaiTerminal() {
  const [screen, setScreen] = useState<Screen>("idle");
  const [now, setNow] = useState(new Date());
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [employee, setEmployee] = useState<EmployeeState | null>(null);
  const [selectedAction, setSelectedAction] = useState<AttendanceEventType | null>(null);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [doneCountdown, setDoneCountdown] = useState(5);
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const storeName = "勤怠登録端末";

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (screen !== "done") return;
    setDoneCountdown(5);
    const id = window.setInterval(() => {
      setDoneCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          resetToIdle();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen === "idle") {
        setScreen("pin");
        return;
      }
      if (screen !== "pin") return;

      if (e.key >= "0" && e.key <= "9") {
        appendPin(e.key);
      } else if (e.key === "Backspace") {
        backspacePin();
      } else if (e.key === "Escape") {
        resetToIdle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, pin, lockUntil]);

  const lockRemain = useMemo(() => {
    if (!lockUntil) return 0;
    const diff = Math.ceil((lockUntil - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  }, [lockUntil, now]);

  useEffect(() => {
    if (!lockUntil) return;
    if (Date.now() >= lockUntil) {
      setLockUntil(null);
      setFailedCount(0);
      setError(null);
    }
  }, [lockUntil, now]);

  async function authenticate(code4: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code4 }),
      });
      const json = (await res.json()) as EmployeeAuthSuccess | ApiError;
      if (!res.ok || !json.ok) {
        setEmployee(null);
        setTodayLogs([]);
        const nextFailed = failedCount + 1;
        setFailedCount(nextFailed);
        if (nextFailed >= 3) {
          setLockUntil(Date.now() + 30_000);
          setError("認証に3回失敗したため、30秒ロックしました。");
        } else {
          setError(json.message || "社員コードを確認してください。");
        }
        setPin("");
        return;
      }

      setEmployee({
        id: json.employee.id,
        name: json.employee.name,
        code4: json.employee.employee_code_4,
      });
      setTodayLogs(json.todayLogs);
      setFailedCount(0);
      setError(null);
      setPin("");
      setScreen("action");
    } catch {
      setError("認証API通信に失敗しました。");
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function registerAttendance() {
    if (!employee || !selectedAction) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          eventType: selectedAction,
          terminalId: getTerminalIdentifier(),
        }),
      });
      const json = (await res.json()) as
        | { ok: true; log: AttendanceLog }
        | ApiError;

      if (!res.ok || !json.ok) {
        setError(json.message || "打刻登録に失敗しました。");
        return;
      }

      setTodayLogs((prev) => [...prev, json.log]);
      setDoneAt(json.log.occurred_at);
      setScreen("done");
    } catch {
      setError("打刻API通信に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function appendPin(digit: string) {
    if (lockRemain > 0 || isSubmitting) return;
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      void authenticate(next);
    }
  }

  function backspacePin() {
    if (lockRemain > 0 || isSubmitting) return;
    setPin((prev) => prev.slice(0, -1));
  }

  function clearPin() {
    if (lockRemain > 0 || isSubmitting) return;
    setPin("");
  }

  function resetToIdle() {
    setScreen("idle");
    setPin("");
    setEmployee(null);
    setSelectedAction(null);
    setDoneAt(null);
    setError(null);
  }

  return (
    <main className="terminal" onClick={() => (screen === "idle" ? setScreen("pin") : undefined)}>
      {screen === "idle" && (
        <section className="panel idle">
          <div className="date">{formatDate(now)}</div>
          <div className="time">{formatTime(now)}</div>
          <div className="hint">タップして打刻してください</div>
          <div className="store">{storeName}</div>
        </section>
      )}

      {screen === "pin" && (
        <section className="panel pin">
          <div className="title">4桁社員コードを入力してください</div>
          <div className="pinDots">
            {Array.from({ length: 4 }).map((_, idx) => (
              <span key={idx} className="dot">
                {idx < pin.length ? "●" : ""}
              </span>
            ))}
          </div>
          {lockRemain > 0 && <p className="lock">ロック中です（残り {lockRemain} 秒）</p>}
          {error && <p className="error">{error}</p>}
          <div className="keypad">
            {keypad.map((key) => (
              <button
                key={key}
                type="button"
                className="key"
                onClick={() => {
                  if (key === "C") clearPin();
                  else if (key === "←") backspacePin();
                  else appendPin(key);
                }}
              >
                {key}
              </button>
            ))}
          </div>
          <button type="button" className="back" onClick={resetToIdle}>
            戻る
          </button>
        </section>
      )}

      {screen === "action" && employee && (
        <section className="panel action">
          <header>
            <div className="employee">{employee.name} さん</div>
            <div className="title">打刻区分を選んでください</div>
          </header>
          {error && <p className="error">{error}</p>}
          <div className="actionBody">
            <div className="actionButtons">
              {Object.entries(labelToEvent).map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  className="actionButton"
                  onClick={() => {
                    setSelectedAction(value);
                    setScreen("confirm");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="history">
              <h2>本日の打刻記録</h2>
              {todayLogs.length === 0 && <p>（まだ打刻なし）</p>}
              {todayLogs.length > 0 && (
                <ul>
                  {todayLogs.map((log) => (
                    <li key={log.id}>
                      {formatHM(log.occurred_at)} - {eventToLabel[log.event_type]}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button type="button" className="back" onClick={resetToIdle}>
            戻る
          </button>
        </section>
      )}

      {screen === "confirm" && employee && selectedAction && (
        <section className="panel confirm">
          <div className="employee">{employee.name} さん</div>
          <div className="confirmAction">{eventToLabel[selectedAction]}</div>
          <div className="question">しますか？</div>
          {error && <p className="error">{error}</p>}
          <div className="confirmButtons">
            <button
              type="button"
              className="cancel"
              onClick={() => {
                setError(null);
                setScreen("action");
              }}
            >
              キャンセル
            </button>
            <button type="button" className="ok" onClick={() => void registerAttendance()} disabled={isSubmitting}>
              {isSubmitting ? "登録中..." : "はい"}
            </button>
          </div>
        </section>
      )}

      {screen === "done" && employee && selectedAction && (
        <section className="panel done">
          <div className="check">✅</div>
          <div className="employee">{employee.name} さん</div>
          <div className="doneAction">
            {eventToLabel[selectedAction]} {doneAt ? formatHM(doneAt) : ""}
          </div>
          <div className="message">打刻しました。</div>
          <div className="countdown"> {doneCountdown} 秒後に待機画面へ戻ります</div>
          <button type="button" className="back" onClick={resetToIdle}>
            すぐ戻る
          </button>
        </section>
      )}
    </main>
  );
}
