"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { isEbookCourse } from "@/lib/format";
import { isPublished } from "@/lib/course/status";
import type { BatchDoc, CourseDoc, UserDoc } from "@/lib/types/firestore";

export function publishedCourses(rows: Array<CourseDoc & { id: string }>) {
  return rows.filter((row) => isPublished(row) && !row.trashed);
}

export async function listCourses() {
  const snap = await getDocs(collection(getDb(), collections.course));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CourseDoc) }));
}

export async function getCourse(id: string) {
  const snap = await getDoc(doc(getDb(), collections.course, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as CourseDoc) };
}

export async function getBatch(id?: string | null) {
  if (!id) return null;
  const snap = await getDoc(doc(getDb(), collections.batches, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as BatchDoc) };
}

type Row = { id: string; [key: string]: unknown };

export async function listChapters(courseId: string) {
  const snap = await getDocs(
    query(
      collection(getDb(), collections.chapter),
      where("courseRef", "==", doc(getDb(), collections.course, courseId)),
    ),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Row)
    .sort((a, b) => Number(a.serialNumber || 0) - Number(b.serialNumber || 0));
}

export async function listLessons(courseId: string) {
  const snap = await getDocs(
    query(
      collection(getDb(), collections.lessons),
      where("courseRef", "==", doc(getDb(), collections.course, courseId)),
    ),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Row)
    .sort((a, b) => Number(a.serialNum || 0) - Number(b.serialNum || 0));
}

export async function listQuizzes(courseId: string) {
  const snap = await getDocs(
    query(
      collection(getDb(), collections.quiz),
      where("courseRef", "==", doc(getDb(), collections.course, courseId)),
    ),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Row)
    .sort((a, b) => Number(a.serialNumber || 0) - Number(b.serialNumber || 0));
}

export function exploreCourses(
  courses: Array<CourseDoc & { id: string }>,
  profile?: Pick<UserDoc, "branchRef"> | null,
) {
  const published = publishedCourses(courses).filter((c) => !isEbookCourse(c));
  if (!profile?.branchRef) return published;
  const preferred = published.filter((c) => c.branchRef?.id === profile.branchRef?.id);
  return preferred.length ? preferred : published;
}

export function storeEbooks(courses: Array<CourseDoc & { id: string }>) {
  return publishedCourses(courses).filter((c) => isEbookCourse(c));
}
