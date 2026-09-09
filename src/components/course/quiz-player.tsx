"use client";

import { useState } from "react";
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
 * Multiple-choice test inside the learn page. Answers are graded server-side;
 * the callable returns the correct option for every question so the student
 * can review what they got wrong.
 */
export function QuizPlayer({ quiz, onExit }: { quiz: QuizDoc & { id: string }; onExit: () => void }) {
  const { t } = useI18n();
  const questions: QuizQuestion[] = quiz.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  const current = questions[index];
  const answered = Object.keys(answers).length;

  async function submit() {
    if (answered < questions.length) {
      setError(t("answerAll"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const fn = httpsCallable<{ quizId: string; answers: Record<string, number> }, SubmitResult>(
        getFns(),
        "submitQuizAttempt",
      );
      const res = await fn({ quizId: quiz.id, answers });
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setError("");
  }

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

  return (
    <div className="flex flex-col gap-4">
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
