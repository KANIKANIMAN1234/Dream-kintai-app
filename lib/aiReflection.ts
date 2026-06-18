export type ReflectionInput = {
  title: string;
  meetingDate: string;
  participants: string;
  notes: string;
  context?: "meeting" | "demo" | "daily";
};

export type ReflectionResult = {
  summary: string;
  decisions: string[];
  todos: string[];
  openQuestions: string[];
  nextActions: string[];
  isDemo: boolean;
};

function splitLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function generateReflection(input: ReflectionInput): ReflectionResult {
  const noteLines = splitLines(input.notes);
  const title = input.title.trim() || "業務振り返り";
  const dateLabel = input.meetingDate || new Date().toISOString().slice(0, 10);

  const todos = noteLines.slice(0, 4);
  if (todos.length === 0 && input.notes.trim()) {
    todos.push(input.notes.trim());
  }

  const summary = [
    `「${title}」（${dateLabel}）`,
    noteLines.length > 0 ? "本日の業務メモをもとに振り返りを作成しました。" : "退勤打刻に合わせた簡易振り返りです。",
  ].join("\n");

  return {
    summary,
    decisions: [],
    todos,
    openQuestions: noteLines.filter((line) => /？|\?|確認|不明/.test(line)).slice(0, 3),
    nextActions: ["明日のシフト・打刻に向けて、申請漏れがないか管理画面で確認してください。"],
    isDemo: true,
  };
}
