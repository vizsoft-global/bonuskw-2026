import { isEbookCourse } from "@/lib/format";
import type { CourseDoc } from "@/lib/types/firestore";

/**
 * The image to show for a course, if any. Courses get the brand-coloured
 * default unless the instructor turned on "override default thumbnail" and
 * uploaded one; eBooks always show their cover.
 */
export function courseThumb(course: Pick<CourseDoc, "image" | "thumbnailOverride" | "itemType">) {
  const image = course.image?.trim();
  if (!image) return undefined;
  if (isEbookCourse(course)) return image;
  return course.thumbnailOverride ? image : undefined;
}
