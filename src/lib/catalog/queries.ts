"use client";

import {
  collection,
  doc,
  getDoc,
  documentId,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { isEbookCourse } from "@/lib/format";
import { isPublished } from "@/lib/course/status";
import type { BatchDoc, CourseDoc } from "@/lib/types/firestore";

export function publishedCourses(rows: Array<CourseDoc & { id: string }>) {
  return rows.filter((row) => isPublished(row) && !row.trashed);
}

export const CATALOG_STALE_MS = 5 * 60_000;

export async function listCourses() {
  const snap = await getDocs(collection(getDb(), collections.course));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CourseDoc) }));
}

export async function getDocsByIds(collectionName: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const out: Record<string, DocumentData> = {};
  const db = getDb();
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await getDocs(query(collection(db, collectionName), where(documentId(), "in", chunk)));
    for (const row of snap.docs) out[row.id] = row.data();
  }
  return out;
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

export async function listResources(courseId: string) {
  const snap = await getDocs(
    query(
      collection(getDb(), collections.courseResources),
      where("courseRef", "==", doc(getDb(), collections.course, courseId)),
    ),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Row)
    .sort((a, b) => Number(a.serialNumber || 0) - Number(b.serialNumber || 0));
}

/** Published, non-ebook courses. Filtering by taxonomy happens in the picker. */
export function exploreCourses(courses: Array<CourseDoc & { id: string }>) {
  return publishedCourses(courses).filter((c) => !isEbookCourse(c));
}

export function storeEbooks(courses: Array<CourseDoc & { id: string }>) {
  return publishedCourses(courses).filter((c) => isEbookCourse(c));
}
