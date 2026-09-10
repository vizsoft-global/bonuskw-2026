"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFns } from "@/lib/firebase/client";
import { useI18n } from "@/lib/i18n/locale";
import type { QuizDoc, QuizQuestion } from "@/lib/types/firestore";
import { cn } from "@/lib/utils";

type ReviewRow = {
  questionId: string;
  chosenIndex: number | null;
  correctIndex: number;
  correct: boolean;
  score: number;
};

type SubmitResult = {
  score: number;
  totalScore: number;
  percent: number;
  correctCount: number;
  questionCount: number;
  passed: boolean;
  attempts: number;
  review?: ReviewRow[];
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Timed attempts survive a reload: the deadline and answers so far live in
 * localStorage until the attempt is submitted, so refreshing the page cannot
 * restart the clock.
 */
type TimedState = { deadline: number; answers: Record<string, number> };

function timedKey(quizId: string) {
  return `quiz-timer:${quizId}`;
}

function readTimed(quizId: string): TimedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(timedKey(quizId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TimedState>;
    if (typeof parsed.deadline !== "number") return null;
    return { deadline: parsed.deadline, answers: parsed.answers ?? {} };
  } catch {
    return null;
  }
}

function writeTimed(quizId: string, state: TimedState | null) {
  if (typeof window === "undefined") return;
  if (!state) window.localStorage.removeItem(timedKey(quizId));
  else window.localStorage.setItem(timedKey(quizId), JSON.stringify(state));
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Multiple-choice test inside the learn page. Answers are graded server-side;
 * the callable returns the correct option for every question so the student
 * can review what they got wrong.
 */
export function QuizPlayer({ quiz, onExit }: { quiz: QuizDoc & { id: string }; onExit: () => void }) {
  const { t } = useI18n();
  const questions: QuizQuestion[] = quiz.questions ?? [];
  const limitMs =
    typeof quiz.timeLimitMin === "number" && quiz.timeLimitMin > 0 ? quiz.timeLimitMin * 60_000 : 0;
  const timed = limitMs > 0;

  // A timed attempt that was started earlier (e.g. before a reload) resumes.
  const [resumed] = useState(() => (timed ? readTimed(quiz.id) : null));
  const [answers, setAnswers] = useState<Record<string, number>>(resumed?.answers ?? {});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [deadline, setDeadline] = useState<number | null>(resumed?.deadline ?? null);
  const [now, setNow] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const [leftWarning, setLeftWarning] = useState(false);
  const [confirmPartial, setConfirmPartial] = useState(false);
  const submittingRef = useRef(false);

  const current = questions[index];
  const answered = Object.keys(answers).length;
  const running = !timed || (deadline !== null && !result);
  const remaining = deadline !== null ? deadline - now : 0;

  const submit = useCallback(
    async (opts?: { force?: boolean; auto?: boolean }) => {
      if (submittingRef.current) return;
      if (!opts?.force && !opts?.auto && answered < questions.length) {
        // Timed tests may be handed in early after an explicit confirmation.
        if (timed) {
          setConfirmPartial(true);
          return;
        }
        setError(t("answerAll"));
        return;
      }
      submittingRef.current = true;
      setBusy(true);
      setError("");
      setConfirmPartial(false);
      try {
        const fn = httpsCallable<{ quizId: string; answers: Record<string, number> }, SubmitResult>(
          getFns(),
          "submitQuizAttempt",
        );
        const res = await fn({ quizId: quiz.id, answers });
        setResult(res.data);
        if (opts?.auto) setTimedOut(true);
        if (timed) writeTimed(quiz.id, null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit");
      } finally {
        setBusy(false);
        submittingRef.current = false;
      }
    },
    [answered, questions.length, timed, quiz.id, answers, t],
  );

  function start() {
    const next = Date.now() + limitMs;
    writeTimed(quiz.id, { deadline: next, answers: {} });
    setDeadline(next);
    setNow(Date.now());
    setError("");
  }

  function retake() {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setError("");
    setTimedOut(false);
    setLeftWarning(false);
    setDeadline(null);
    if (timed) writeTimed(quiz.id, null);
  }

  // Keep the persisted attempt in sync with the answers chosen so far.
  useEffect(() => {
    if (!timed || deadline === null || result) return;
    writeTimed(quiz.id, { deadline, answers });
  }, [timed, deadline, answers, result, quiz.id]);

  // Tick once a second while a timed attempt is open; auto-submit at zero.
  useEffect(() => {
    if (!timed || deadline === null || result) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) void submit({ auto: true });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timed, deadline, result, submit]);

  // Leaving the tab/screen mid-attempt: warn on return, and confirm before unload.
  useEffect(() => {
    if (!timed || deadline === null || result) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") setLeftWarning(true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [timed, deadline, result]);

  if (!questions.length) {
    return (
      <div className="rounded-[16px] border border-white/15 p-5 text-[13px] text-[#999]">
        {t("empty")}
      </div>
    );
  }

  if (result) {
    const reviewById = new Map((result.review ?? []).map((r) => [r.questionId, r]));
    return (
      <div className="flex flex-col gap-4">
        {timedOut ? (
          <p className="rounded-[12px] border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-4 py-3 text-[13px] text-[#fbbf24]">
            {t("timeUp")}
          </p>
        ) : null}
        <div className="rounded-[16px] border border-white/15 bg-white/[0.04] p-5">
          <p className="text-[12px] text-[#999]">{t("yourScore")}</p>
          <p className="mt-1 text-[32px] font-semibold text-[#fafafa]">
            {result.correctCount}/{result.questionCount}
            <span className="ms-2 text-[16px] font-medium text-[#999]">{Math.round(result.percent)}%</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 font-medium",
                result.passed ? "bg-[#10b981]/15 text-[#10b981]" : "bg-[#f24822]/15 text-[#f24822]",
              )}
            >
              {result.passed ? t("passedTest") : t("failedTest")}
            </span>
            <span className="text-[#999]">
              {t("attempts")}: {result.attempts}
            </span>
          </div>
        </div>

        <h3 className="text-[14px] font-medium text-[#fafafa]">{t("reviewAnswers")}</h3>
        <ol className="flex flex-col gap-3">
          {questions.map((q, i) => {
            const review = reviewById.get(q.id);
            const chosen = answers[q.id];
            const correctIndex = review?.correctIndex ?? -1;
            return (
              <li key={q.id} className="rounded-[14px] border border-white/10 p-4">
                <p className="text-[13px] font-medium text-[#fafafa]">
                  {i + 1}. {q.text}
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {(q.options ?? []).map((opt, oi) => {
                    const isCorrect = oi === correctIndex;
                    const isChosen = oi === chosen;
                    return (
                      <li
                        key={oi}
                        className={cn(
                          "flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px]",
                          isCorrect
                            ? "border-[#10b981] bg-[#10b981]/10 text-[#fafafa]"
                            : isChosen
                              ? "border-[#f24822] bg-[#f24822]/10 text-[#fafafa]"
                              : "border-white/10 text-[#999]",
                        )}
                      >
                        <span className="w-5 shrink-0 text-[11px] font-bold">{LETTERS[oi] ?? oi + 1}</span>
                        <span className="min-w-0 flex-1">{opt}</span>
                        {isCorrect ? (
                          <span className="text-[11px] font-medium text-[#10b981]">{t("correctAnswer")}</span>
                        ) : isChosen ? (
                          <span className="text-[11px] font-medium text-[#f24822]">{t("yourAnswer")}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={retake}
            className="min-h-11 rounded-2xl border border-white/20 px-4 text-[13px] font-medium text-[#fafafa]"
          >
            {t("retakeTest")}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-11 rounded-2xl bg-[#0c5eff] px-4 text-[13px] font-semibold text-white"
          >
            {t("backToLessons")}
          </button>
        </div>
      </div>
    );
  }

  if (timed && !running) {
    return (
      <div className="flex flex-col gap-4 rounded-[16px] border border-white/15 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#0c5eff]/15 text-[#0c5eff]">
            <ClockIcon />
          </span>
          <div>
            <p className="text-[12px] text-[#999]">{t("timeLimit")}</p>
            <p className="text-[20px] font-semibold text-[#fafafa]">
              {quiz.timeLimitMin} {t("minutes")}
            </p>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-[#bbb]">{t("timedTestIntro")}</p>
        <p className="text-[12px] text-[#999]">
          {questions.length} {t("questions")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={start}
            className="min-h-11 rounded-2xl bg-[#0c5eff] px-5 text-[13px] font-semibold text-white"
          >
            {t("startTest")}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-11 rounded-2xl border border-white/20 px-4 text-[13px] font-medium text-[#fafafa]"
          >
            {t("backToLessons")}
          </button>
        </div>
      </div>
    );
  }

  const urgent = timed && remaining <= 60_000;

  return (
    <div className="flex flex-col gap-4">
      {timed ? (
        <div
          className={cn(
            "flex items-center justify-between rounded-[12px] border px-4 py-2.5",
            urgent ? "border-[#f24822]/50 bg-[#f24822]/10" : "border-white/15 bg-white/[0.04]",
          )}
          role="timer"
          aria-live={urgent ? "assertive" : "off"}
        >
          <span className="flex items-center gap-2 text-[12px] text-[#999]">
            <ClockIcon />
            {t("timeLeft")}
          </span>
          <span
            className={cn(
              "font-mono text-[18px] font-semibold tabular-nums",
              urgent ? "text-[#f24822]" : "text-[#fafafa]",
            )}
          >
            {formatClock(remaining)}
          </span>
        </div>
      ) : null}
      {leftWarning ? (
        <div className="flex items-start justify-between gap-3 rounded-[12px] border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-4 py-3 text-[13px] text-[#fbbf24]">
          <span>{t("leftTestWarning")}</span>
          <button
            type="button"
            onClick={() => setLeftWarning(false)}
            aria-label="Dismiss"
            className="shrink-0 text-[#fbbf24]/80 hover:text-[#fbbf24]"
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between text-[12px] text-[#999]">
        <span>
          {t("question")} {index + 1} {t("of")} {questions.length}
        </span>
        <span>
          {answered}/{questions.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#0c5eff]" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      {current ? (
        <div className="rounded-[16px] border border-white/15 bg-white/[0.04] p-5">
          <p className="text-[15px] font-medium text-[#fafafa]">{current.text}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {(current.options ?? []).map((opt, oi) => {
              const selected = answers[current.id] === oi;
              return (
                <li key={oi}>
                  <button
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: oi }))}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-[12px] border px-3 py-2 text-start text-[13px]",
                      selected
                        ? "border-[#0c5eff] bg-[#0c5eff]/15 text-[#fafafa]"
                        : "border-white/15 text-[#fafafa] hover:border-white/30",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold",
                        selected ? "border-[#0c5eff] bg-[#0c5eff] text-white" : "border-white/30",
                      )}
                    >
                      {LETTERS[oi] ?? oi + 1}
                    </span>
                    {opt}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-[12px] text-[#f24822]">{error}</p> : null}
      {confirmPartial ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-white/15 bg-white/[0.04] px-4 py-3 text-[13px] text-[#fafafa]">
          <span>
            {questions.length - answered} {t("unansweredLeft")}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmPartial(false)}
              className="min-h-9 rounded-xl border border-white/20 px-3 text-[12px]"
            >
              {t("previousQuestion")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit({ force: true })}
              className="min-h-9 rounded-xl bg-[#f24822] px-3 text-[12px] font-semibold text-white disabled:opacity-60"
            >
              {t("submitAnyway")}
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="min-h-11 rounded-2xl border border-white/20 px-4 text-[13px] font-medium text-[#fafafa] disabled:opacity-40"
        >
          {t("previousQuestion")}
        </button>
        {index < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="min-h-11 rounded-2xl bg-white px-4 text-[13px] font-semibold text-black"
          >
            {t("nextQuestion")}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="min-h-11 rounded-2xl bg-[#0c5eff] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "…" : t("submitTest")}
          </button>
        )}
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
