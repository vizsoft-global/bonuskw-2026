import { accessIsLive } from "@/lib/course/access-window";
import type { BatchDoc, CourseDoc, UserDoc } from "@/lib/types/firestore";

/**
 * Who sees a course without paying for it.
 *
 * An instructor needs to see their own course the way a student does — that is
 * how they check their lessons before students arrive — and a university
 * manager already has their university's courses in the panel. Both get the
 * whole course without an enrolment; everyone else (including super admins and
 * other staff) buys it like any student.
 *
 * This replaces the payment only. Everything else still applies exactly as it
 * does for a student who bought it: instructor locks still hide content, and
 * the batch still has to be running.
 */

/** Panel role id for university managers; mirrors the admin panel's roles. */
const UNIVERSITY_MANAGER_ROLE_ID = "university-manager";

type Profile = Pick<UserDoc, "panelRoleId" | "universityRef"> | null | undefined;
type Course = CourseDoc | null | undefined;

/** The instructor who created the course, or any of its co-instructors. */
export function ownsCourse(course: Course, uid?: string | null) {
  if (!course || !uid) return false;
  if (course.authorRef?.id === uid) return true;
  return (course.instructorRefs ?? []).some((ref) => ref?.id === uid);
}

function managesUniversityOf(course: Course, profile: Profile) {
  if (profile?.panelRoleId !== UNIVERSITY_MANAGER_ROLE_ID) return false;
  const university = profile.universityRef?.id;
  if (!university) return false;
  const refs = [course?.universityRef, ...(course?.universityRefs ?? [])];
  return refs.some((ref) => ref?.id === university);
}

export function hasOwnerAccess(input: {
  course: Course;
  profile: Profile;
  uid?: string | null;
  /** The course's batch; the same term rule students are held to. */
  batch?: Pick<BatchDoc, "status" | "endDate"> | null;
  now?: Date;
}) {
  const { course, profile, uid, batch, now } = input;
  if (!course || !uid) return false;
  if (!ownsCourse(course, uid) && !managesUniversityOf(course, profile)) return false;
  return accessIsLive(course, batch ?? null, now);
}
