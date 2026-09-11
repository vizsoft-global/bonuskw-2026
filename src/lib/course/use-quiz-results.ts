import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import type { QuizResultSummary } from "@/components/course/chapter-sections";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { QuizResultDoc } from "@/lib/types/firestore";

/** The student's latest result for every test in a course, by quiz id. */
export function useQuizResults(courseId: string, uid?: string) {
  return useQuery({
    queryKey: ["quiz-results", courseId, uid],
    enabled: Boolean(courseId && uid),
    queryFn: async () => {
      const db = getDb();
      const snap = await getDocs(
        query(
          collection(db, collections.quizResult),
          where("userRef", "==", doc(db, collections.users, uid!)),
          where("courseRef", "==", doc(db, collections.course, courseId)),
        ),
      );
      const out: Record<string, QuizResultSummary> = {};
      for (const row of snap.docs) {
        const data = row.data() as QuizResultDoc;
        const quizId = data.quizRef?.id;
        if (!quizId) continue;
        out[quizId] = {
          percent: Math.round(Number(data.percent ?? 0)),
          passed: Boolean(data.passed),
          attempts: Number(data.attempts ?? 1),
        };
      }
      return out;
    },
  });
}
