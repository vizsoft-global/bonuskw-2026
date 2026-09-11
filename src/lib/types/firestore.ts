import type { Timestamp, DocumentReference } from "firebase/firestore";

export type UserRole = "Admin" | "Instructor" | "Student" | string;
export type InstructorStatus = "Approved" | "Pending" | "Rejected" | string;

export type UserDoc = {
  email?: string;
  display_name?: string;
  photo_url?: string;
  uid?: string;
  created_time?: Timestamp | Date;
  phone_number?: string;
  /** Canonical +965… form of `phone_number`; used for sign-in matching. */
  phoneE164?: string;
  lastActive?: Timestamp | Date;
  status?: string;
  userRole?: UserRole;
  location?: string;
  userSex?: string;
  countryRef?: DocumentReference;
  universityRef?: DocumentReference;
  branchRef?: DocumentReference;
  categoryRef?: DocumentReference;
  fvrtCourseList?: DocumentReference[];
  /** Which EMI reminder cycle this student sits in. See `emiSchedule`. */
  emiScheduleRef?: DocumentReference;
  role?: string;
  /** Panel RBAC role id pointing at `roles/{id}`. Legacy Admins without this are treated as super-admin. */
  panelRoleId?: string;
  bio?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  instuctorStatus?: InstructorStatus;
  instructorFolderID?: string;
  instructorFolderStatus?: string;
  folderID?: string;
  blockReason?: string;
  instructorRejectReason?: string;
  age?: number;
  dob?: Timestamp | Date;
  phoneVerified?: boolean;
  emailVerifed?: boolean;
  welcomeStatus?: boolean;
  updatedAt?: Timestamp | Date;
  year_of_study?: string;
};

/** A purchasable download attached to an eBook. */
export type EbookFileDoc = {
  id: string;
  name: string;
  /** "pdf" | "video" | "file" */
  kind: string;
  /**
   * Object key. `provider: "r2"` files live behind the Cloudflare files gateway
   * (signed per-buyer links); older ones are Firebase Storage paths.
   */
  storagePath: string;
  provider?: "r2" | "firebase";
  contentType?: string;
  bytes?: number;
  uploadedAt?: Timestamp | Date;
  uploadedBy?: DocumentReference;
};

/** Written by the student app each time a buyer opens an eBook file. */
export type EbookDownloadDoc = {
  courseRef?: DocumentReference;
  userRef?: DocumentReference;
  fileId?: string;
  fileName?: string;
  downloadedAt?: Timestamp | Date;
  ip?: string;
  device?: string;
};

export type CourseDoc = {
  name?: string;
  image?: string;
  /**
   * "course" (default when absent — every legacy document is a course) or
   * "ebook". eBooks are a separate product: a bundle of downloadable files
   * rather than a lesson tree, tracked in `ebookFiles`.
   */
  itemType?: string;
  ebookFiles?: EbookFileDoc[];
  universityRef?: DocumentReference;
  branchRef?: DocumentReference;
  authorRef?: DocumentReference;
  price?: number;
  numberLessons?: number;
  totalHours?: number;
  subtitle?: string;
  description?: string;
  video?: string;
  /**
   * Everyone allowed to edit the course, `authorRef` included. The student app
   * only ever reads `authorRef` (the name on the course card), so co-instructors
   * live here and the two are kept in sync by `src/lib/course/access.ts`.
   */
  instructorRefs?: DocumentReference[];
  courseCategoryRef?: DocumentReference;
  countryRef?: DocumentReference;
  categoryRef?: DocumentReference;
  totalCourseHour?: number;
  courseLearn?: string;
  courseRequirement?: string;
  /** "Free" | "Paid" */
  coursePaymentType?: string;
  totalRatting?: number;
  /** "Draft" | "Publish" | "Published" | "Archived" */
  status?: string;
  batchesRef?: DocumentReference;
  videoRef?: DocumentReference;
  sku?: string;
  bookingLimit?: number;
  bookedCount?: number;
  whatsappGroupLink?: string;
  /** Toggle: buyers must submit their university schedule before enrolling. */
  university_schedule_required?: boolean;
  /** True when the course is sold in installments rather than one payment. */
  emiPaymentStatus?: boolean;
  /** Legacy mirror of `emiAmounts[0..2]`. */
  firstEMIprice?: number;
  secondEMIprice?: number;
  thirdEMIprice?: number;
  /** Number of installments in the plan (2–6). Legacy courses default to 3. */
  emiCount?: number;
  /** Amount of each installment, `emiCount` entries. */
  emiAmounts?: number[];
  emiScheduleRef?: DocumentReference;
  /**
   * How the three installment amounts were (or should be) derived from `price`.
   * `custom` means an admin edited the amounts by hand.
   */
  emiSplitMode?: "even" | "nice" | "frontload" | "backload" | "custom";
  /**
   * @deprecated Course-wide 2nd-installment reminder date. Due dates now come
   * from the student's EMI schedule day — do not write new values.
   */
  dateSecondEMI_email?: Timestamp | Date;
  /**
   * @deprecated Course-wide 3rd-installment reminder date. Due dates now come
   * from the student's EMI schedule day — do not write new values.
   */
  dateThirdEMI_email?: Timestamp | Date;
  /**
   * Placement flags. Firestore stores an array holding a single string, not
   * separate booleans: `["Recommended"]`, `["Featured"]` or `[]`.
   */
  listView?: string[];
  created_at?: Timestamp | Date;
  /** Soft-delete: hidden from lists; purged after purgeAt. */
  trashed?: boolean;
  deletedAt?: Timestamp | Date;
  deletedBy?: DocumentReference;
  purgeAt?: Timestamp | Date;
  statusBeforeDelete?: string;
  purgedAt?: Timestamp | Date;
  tombstone?: boolean;
  nameManualTranslate?: { ar?: string; en?: string };
  subtitleManualTranslate?: { ar?: string; en?: string };
  nameAutoTranslate?: { ar?: string; en?: string };
  subtitleAutoTranslate?: { ar?: string; en?: string };
};

/** Per-student enrollment and installment tracking. */
export type SubscriptionDoc = {
  userRef?: DocumentReference;
  courseRef?: DocumentReference;
  batchesRef?: DocumentReference;
  startDate?: Timestamp | Date;
  /** "Full payment" | "EMI" */
  paymentType?: string;
  /**
   * Full-payment capture status, "CAPTURED" when paid. Note the snake_case:
   * the installment equivalents beneath are camelCase.
   */
  payment_status?: string;
  payment_id?: string;
  firstPaymentID?: string;
  firstPaymentStatus?: string;
  secondPaymentID?: string;
  secondPaymentStatus?: string;
  thirdPaymentID?: string;
  thirdPaymentStatus?: string;
  firstEMIvalidUpto?: Timestamp | Date;
  secondEMIvalidUpto?: Timestamp | Date;
  thirdEMIvalidUpto?: Timestamp | Date;
  /** Plan size (2–6); legacy EMI subscriptions default to 3. */
  installmentCount?: number;
  /** Installments captured so far. */
  paidCount?: number;
  emiAmounts?: number[];
  nextDueAt?: Timestamp | Date | null;
  /** "Ongoing" | "Archived" */
  status?: string;
  courseUniversitySchedule?: string;
};

/**
 * Groups students by when they prefer to pay, so installment reminders can go
 * out on a date that suits them rather than one fixed date per course.
 */
export type EmiScheduleDoc = {
  name?: string;
  description?: string;
  /**
   * First day of the month payment window (1-28). Installments open / due
   * from this day; reminders start here. Prefer over `secondEmiDay` / `thirdEmiDay`.
   */
  day?: number;
  /**
   * Last day of the month payment window (1-28, >= `day`). Students can pay
   * through this day; overdue flips the day after. Defaults to `day` when unset.
   */
  dayEnd?: number;
  /** @deprecated Prefer `day`. Kept as fallback for older schedules. */
  secondEmiDay?: number;
  /** @deprecated Prefer `day`. */
  thirdEmiDay?: number;
  status?: string;
  createdAt?: Timestamp | Date;
};

export type MediaProvider = "images" | "stream" | "firebase" | "vdocipher";

/** One record per uploaded asset, whichever provider stores the bytes. */
export type MediaAssetDoc = {
  provider?: MediaProvider;
  kind?: "image" | "video" | "file";
  /** Cloudflare image id or Stream uid. Absent for legacy Firebase uploads. */
  cfId?: string;
  /** Direct URL. Always set for firebase/vdocipher, derived for Cloudflare. */
  url?: string;
  /** Firebase Storage object path for `kind: "file"` uploads. */
  storagePath?: string;
  name?: string;
  status?: "uploading" | "processing" | "live" | "error";
  errorMessage?: string;
  bytes?: number;
  width?: number;
  height?: number;
  /** Seconds. */
  duration?: number;
  thumbnailUrl?: string;
  /** 0-1 position of the Stream poster frame. */
  thumbnailTimestampPct?: number;
  uploadedBy?: DocumentReference;
  /** Media explorer folder membership (multi-parent). */
  folderIds?: string[];
  createdAt?: Timestamp | Date;
};

/** Folder node in the Media explorer (videos / images / files trees). */
export type MediaFolderDoc = {
  name: string;
  kind: "video" | "image" | "file";
  parentId: string | null;
  ownerRef?: DocumentReference;
  /** Legacy VdoCipher folder tag (BSFLxxxx) used for migration. */
  legacyId?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
};

export type OrderItem = {
  courseRef?: DocumentReference;
  createdAt?: Timestamp | Date;
  price?: number;
  salesPrice?: number;
  quantity?: number;
  subTotal?: number;
  paymentType?: string;
  courseName?: string;
  courseImage?: string;
  itemKind?: "course" | "chapter" | "ebook" | "installment";
  chapterRef?: DocumentReference;
  chapterName?: string;
};

export type OrderLineKind = "course" | "chapter" | "ebook" | "installment";

/** Priced line on a Payments v2 order (`orders.lines[]`). */
export type OrderLine = {
  kind: OrderLineKind;
  courseRef: DocumentReference;
  chapterRef?: DocumentReference;
  installmentRef?: DocumentReference;
  batchesRef?: DocumentReference;
  /** "Full payment" | "EMI" — EMI only for kind course. */
  paymentType: string;
  listPrice: number;
  discount: number;
  amountTotal: number;
  /** Charged now: full total, first EMI, chapter/ebook price, or installment amount. */
  amountNow: number;
  /** Post-coupon EMI split for course EMI lines. */
  installments?: number[];
  courseName?: string;
  chapterName?: string;
  /** List price before promotions (same as listPrice when none applied). */
  originalPrice?: number;
  promotionDiscount?: number;
  promotionRefs?: DocumentReference[] | { id: string; path?: string }[];
  /** Student already owns this line — charged as 0. */
  owned?: boolean;
};

export type OrderPromotionApplied = {
  id: string;
  name?: { en: string; ar?: string };
  badge?: string;
  discount: number;
  lineIndexes?: number[];
};

export type OrderDoc = {
  userRef?: DocumentReference;
  cartTotal?: number;
  orderID?: string;
  status?: string;
  /** Raw Tap charge status when present. */
  gatewayStatus?: string;
  chargeId?: string;
  item?: DocumentReference[];
  createdAt?: Timestamp | Date;
  order?: string;
  paymentmethod?: string;
  paymenttype?: string;
  couponRef?: DocumentReference;
  couponCode?: string;
  orderProcesses?: string;
  /** Legacy cart lines — still written for compatibility. */
  order_items?: OrderItem[];
  /** Payments v2 priced lines. */
  lines?: OrderLine[];
  /** Idempotency keys `orderId:lineIndex` already fulfilled. */
  fulfilledLines?: string[];
  dueNow?: number;
  /** Denormalized universities from cart courses — for university-manager scoping. */
  universityRefs?: DocumentReference[];
  promotions?: OrderPromotionApplied[];
  promotionDiscount?: number;
  savings?: number;
};

/**
 * Per-installment ledger row. One doc per tranche on an EMI subscription.
 * Collection: `installments`.
 */
export type InstallmentDoc = {
  userRef?: DocumentReference;
  subscriptionRef?: DocumentReference;
  courseRef?: DocumentReference;
  orderRef?: DocumentReference;
  /** 1-based position in the plan (1..6). */
  index?: number;
  count?: number;
  amount?: number;
  /** "paid" | "due" | "overdue" | "waived" */
  status?: string;
  /** Window open / due start. */
  dueDate?: Timestamp | Date;
  /** Last day of the payment window; overdue after this. Defaults to dueDate. */
  dueEndDate?: Timestamp | Date;
  paidAt?: Timestamp | Date;
  paymentId?: string;
  remindedAt?: (Timestamp | Date)[];
  courseName?: string;
  createdAt?: Timestamp | Date;
};

/**
 * Single-chapter purchase access. Collection: `chapterAccess`.
 * Kept separate from `subscription` so course-level queries stay unchanged.
 */
export type ChapterAccessDoc = {
  userRef?: DocumentReference;
  courseRef?: DocumentReference;
  chapterRef?: DocumentReference;
  batchesRef?: DocumentReference;
  orderRef?: DocumentReference;
  price?: number;
  payment_id?: string;
  payment_status?: string;
  paymentType?: string;
  startDate?: Timestamp | Date;
  /** "Ongoing" | "Archived" */
  status?: string;
  chapterName?: string;
  courseName?: string;
};

/**
 * eBook purchase access. Collection: `ebookAccess`.
 */
export type EbookAccessDoc = {
  userRef?: DocumentReference;
  courseRef?: DocumentReference;
  batchesRef?: DocumentReference;
  orderRef?: DocumentReference;
  price?: number;
  payment_id?: string;
  payment_status?: string;
  paymentType?: string;
  startDate?: Timestamp | Date;
  /** "Ongoing" | "Archived" */
  status?: string;
  courseName?: string;
};

/** Cron log for EMI reminder pushes. Collection: `emiReminders`. */
export type EmiReminderDoc = {
  userRef?: DocumentReference;
  installmentRefs?: DocumentReference[];
  totalAmount?: number;
  courseCount?: number;
  pushRef?: DocumentReference;
  createdAt?: Timestamp | Date;
};

export type ChapterDoc = {
  name?: string;
  description?: string;
  courseRef?: DocumentReference;
  serialNumber?: number;
  /** Chapter lock. Boolean in Firestore, not a status string. */
  status?: boolean;
  /** Legacy gate: "First" | "Second" | "Third". */
  emiType?: string;
  /** 1-based installment that unlocks this chapter. */
  emiIndex?: number;
  /** When true, chapter can be bought alone (paid non-ebook courses only). */
  sellable?: boolean;
  /** Standalone chapter price in KWD. */
  price?: number;
  course_sku?: string;
  chapter_sku?: string;
  created_at?: Timestamp | Date;
};

export type LessonFile = {
  lesson_created_at?: Timestamp | Date;
  lesson_status?: string;
  lesson_order?: number;
  lesson_download_status?: boolean;
  lesson_file_link?: string;
};

export type LessonDoc = {
  name?: string;
  description?: string;
  chapterRef?: DocumentReference;
  courseRef?: DocumentReference;
  image?: string;
  video?: string;
  videoRef?: DocumentReference;
  videoDuration?: number;
  serialNum?: number;
  /** "Lock" | "Unlock" */
  lessonStatus?: string;
  lesson_lock_status?: boolean;
  lesson_file_list?: LessonFile[];
  course_sku?: string;
  chapter_sku?: string;
  lesson_sku?: string;
  created_at?: Timestamp | Date;
};

/** Public MCQ question — correct index lives in `quizAnswerKey`, not here. */
export type QuizQuestion = {
  id: string;
  text: string;
  options: string[];
  score: number;
};

/** A downloadable file sitting in the course outline. Collection: `courseResources`. */
export type CourseResourceDoc = {
  courseRef?: DocumentReference;
  /** The chapter this file is shown under; files always belong to a chapter. */
  chapterRef?: DocumentReference;
  serialNumber?: number;
  name?: string;
  description?: string;
  url?: string;
  storagePath?: string;
  contentType?: string;
  bytes?: number;
  /** "pdf" | "image" | "audio" | "video" | "file" */
  kind?: string;
  /** Unlocked when true or unset. */
  status?: boolean;
  emiIndex?: number;
  created_at?: Timestamp | Date;
};

export type QuizDoc = {
  name?: string;
  description?: string;
  courseRef?: DocumentReference;
  /** Shares the chapter outline number line (1..n with chapters). */
  serialNumber?: number;
  /** Unlocked when true (same convention as `chapter.status`). */
  status?: boolean;
  /** Optional pass threshold as a percent of totalScore. */
  passPercent?: number;
  /** Optional time limit in minutes; the player auto-submits at zero. */
  timeLimitMin?: number | null;
  questions?: QuizQuestion[];
  questionCount?: number;
  totalScore?: number;
  created_at?: Timestamp | Date;
  updated_at?: Timestamp | Date;
  createdBy?: DocumentReference;
};

export type QuizAnswerKeyDoc = {
  courseRef?: DocumentReference;
  quizRef?: DocumentReference;
  /** Map of questionId → correct option index. */
  answers?: Record<string, number>;
};

/** One doc per student per quiz; id `{quizId}_{uid}`. Latest attempt wins. */
export type QuizResultDoc = {
  quizRef?: DocumentReference;
  courseRef?: DocumentReference;
  userRef?: DocumentReference;
  score?: number;
  totalScore?: number;
  percent?: number;
  correctCount?: number;
  questionCount?: number;
  passed?: boolean;
  answers?: Record<string, number>;
  attempts?: number;
  firstAttemptAt?: Timestamp | Date;
  lastAttemptAt?: Timestamp | Date;
};


export type ReviewDoc = {
  userRef?: DocumentReference;
  courseRef?: DocumentReference;
  rating?: number;
  review?: string;
  createdAt?: Timestamp | Date;
  status?: string;
};

export type FolderDoc = {
  folder_name?: string;
  folder_main_id?: string;
  folder_status?: string;
  folder_created_at?: Timestamp | Date;
  folder_created_user_ref?: DocumentReference;
  folder_created_user_role?: string;
  folder_subfolder_info?: { folder_id?: string; folder_name?: string }[];
};

export type VideoDoc = {
  videoId?: string;
  title?: string;
  description?: string;
  webURL?: string;
  mobURL?: string;
  createdAt?: Timestamp | Date;
  projectId?: string;
  /** VdoCipher transcode status code, not a label. Never write a string here. */
  status?: number;
  images?: string;
  duration?: string;
  iframeLink?: string;
  autherRef?: DocumentReference;
  /** VdoCipher tags; the old admin tagged each upload with its folder id. */
  tags?: string[];
  fileSizeMB?: number;
  download_url?: string;
  /**
   * Absent on every existing row, which are all VdoCipher. Set to "stream" on
   * new Cloudflare uploads so players can branch. Keeping both providers in
   * this one collection is what lets `videoRef` carry on working unchanged.
   */
  provider?: MediaProvider;
  /** Cloudflare Stream uid. */
  cfId?: string;
  /** Cloudflare's own state, kept apart from the numeric VdoCipher `status`. */
  cfStatus?: "uploading" | "processing" | "live" | "error";
  /** VdoCipher string status (ready / Queued / PRE-Upload / …). */
  vdoStatus?: string;
  /** Poster URLs returned by VdoCipher. */
  posters?: string[];
  /** True when the VdoCipher id is gone but the Firestore row remains. */
  missingAtProvider?: boolean;
  /** Last successful sync from VdoCipher. */
  syncedAt?: Timestamp | Date;
  errorMessage?: string;
  width?: number;
  height?: number;
  /** Seconds. Distinct from `duration`, which VdoCipher stores as a string. */
  durationSeconds?: number;
  thumbnailTimestampPct?: number;
  /** Media explorer folder membership (multi-parent). */
  folderIds?: string[];
  /** Firebase Storage path while VdoCipher is importing; cleared when ready. */
  stagingPath?: string;
  /** True after stream/library bytes were removed during a course purge. */
  purged?: boolean;
};

export type MediaUploadStatus =
  | "uploading"
  | "paused"
  | "staged"
  | "importing"
  | "processing"
  | "ready"
  | "error";

/** In-progress / recent VdoCipher upload jobs (visible across devices). */
export type MediaUploadDoc = {
  ownerRef?: DocumentReference;
  uploadedBy?: DocumentReference;
  name: string;
  size: number;
  bytesUploaded: number;
  status: MediaUploadStatus;
  videoId?: string;
  folderId?: string | null;
  storagePath?: string;
  error?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
};

/** Super-admin media provider preference. Doc id is always `media`. */
export type AdminMediaConfigDoc = {
  videoProvider?: "vdocipher" | "stream";
  updatedAt?: Timestamp | Date;
  updatedBy?: DocumentReference;
};

/** Counters used for BSFL tag allocation. Doc id is always `counters`. */
export type AdminCountersDoc = {
  nextBsfl?: number;
};

/** Sidebar navigation layout. Doc id is always `navigation`. */
export type NavConfigItem = {
  id: string;
  kind: "builtin" | "custom";
  href: string;
  /** `/icons/x.svg` or `lucide:IconName` */
  icon: string;
  labelKey?: string;
  label?: { en: string; ar: string };
  permission?: string;
  external?: boolean;
  hidden: boolean;
  /** panelRoleIds that should not see this item */
  hiddenForRoles: string[];
};

export type AdminNavigationDoc = {
  admin?: NavConfigItem[];
  instructor?: NavConfigItem[];
  updatedAt?: Timestamp | Date;
};

/** One media segment inside a story. */
export type StoryMedia = {
  url?: string;
  /** "image" | "video" | "audio" | "file" */
  type?: string;
  kind?: string;
  name?: string;
  bytes?: number;
  contentType?: string;
  /** Poster shown behind audio / file segments. */
  poster?: string;
  /** Seconds this segment stays on screen (images/audio/files). */
  durationSec?: number;
};

export type SettingsStory = {
  /** Display title. `name` mirrors it for the Flutter app. */
  title?: string;
  name?: string;
  /** Caption written in the admin; shown over the media while the story plays. */
  description?: string;
  /** Thumbnail / poster; also the media for image stories. */
  image?: string;
  images?: string[];
  video?: string;
  /** Legacy Flutter field for video stories. */
  video_url?: string;
  videos?: string[];
  media?: Array<string | StoryMedia>;
  status?: string;
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
  /** "image" | "video" | "audio" | "file" */
  type?: string;
  linkedRef?: DocumentReference;
  redirect_url?: string;
  /** Default seconds per segment. */
  durationSec?: number;
  created_at?: Timestamp | Date;
  id?: string;
};

export type PopupLocation = "home" | "course" | "cart";

export type CustomPopup = {
  id: string;
  title?: string;
  subtitle?: string;
  message?: string;
  media?: StoryMedia[];
  locations?: PopupLocation[];
  courseIds?: string[];
  status?: string;
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
  redirect_url?: string;
  buttonLabel?: string;
  created_at?: Timestamp | Date;
};

export type SettingsDoc = {
  logo?: string;
  faviicon?: string;
  settings_status?: SettingsStory[];
  popupMsg?: {
    title?: string;
    subtitle?: string;
    message?: string;
    image?: string;
    images?: string[];
  };
  popupItems?: CustomPopup[];
};

export type CouponDoc = {
  /** The coupon code. Field is `name`, not `code`. */
  name?: string;
  amount?: number;
  discount?: number;
  usage?: number;
  totalUsage?: number;
  minimumAmount?: number;
  maximumAmount?: number;
  /** "Amount" | "Discount" */
  type?: string;
  /** "Active" | "Deactive" */
  status?: string;
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
  /** Required: at least one course. Empty list does not apply at checkout. */
  courseList?: DocumentReference[];
  /**
   * Denormalized from courseList for university-manager queries. All courses on
   * a manager-created coupon must share this university.
   */
  universityRef?: DocumentReference;
  orderRef?: DocumentReference[];
  userRef?: DocumentReference[];
};




export type BatchDoc = {
  id?: string;
  name?: string;
  description?: string;
  image?: string;
  /** "Ongoing" | "Archived" */
  status?: string;
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
  bookingLimit?: number;
  courseRef?: DocumentReference[];
  archiveCourseRef?: DocumentReference[];
};

export type LookupDoc = {
  name?: string;
  status?: string;
  countryRef?: DocumentReference;
  universityRef?: DocumentReference;
};

export type SessionDoc = {
  userRef?: DocumentReference;
  device?: string;
  os?: string;
  ip?: string;
  location?: string;
  createdAt?: Timestamp | Date;
};

export type ActivityLogDoc = {
  userRef?: DocumentReference;
  action?: string;
  createdAt?: Timestamp | Date;
};

export type RoleDoc = {
  name: string;
  description?: string;
  permissions: string[];
  builtin?: boolean;
  locked?: boolean;
  permissionsVersion?: number;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
};

export type InstructorRequestDoc = {
  userRef?: DocumentReference;
  status?: string;
  createdAt?: Timestamp | Date;
};

export type LocalizedText = { en: string; ar?: string };

export type PromotionType =
  | "item_discount"
  | "bundle"
  | "quantity_tiers"
  | "cart_threshold"
  | "buy_x_get_y";

export type PromotionScopeKind =
  | "all"
  | "courses"
  | "categories"
  | "instructors"
  | "universities";

export type PromotionScope = {
  kind: PromotionScopeKind;
  refs?: DocumentReference[];
};

export type PromotionReward =
  | { kind: "percent"; value: number }
  | { kind: "fixed"; value: number }
  | { kind: "fixed_price"; value: number };

export type PromotionTier = {
  minItems?: number;
  minSubtotal?: number;
  percent?: number;
  fixed?: number;
};

export type PromotionStatus = "Draft" | "Active" | "Paused";

/** Dynamic pricing / bundle / BOGO rule. Collection: `promotions`. */
export type PromotionDoc = {
  name?: LocalizedText;
  description?: LocalizedText;
  badge?: string;
  bannerImage?: string;
  showOnPromotionsPage?: boolean;
  featured?: boolean;
  sortOrder?: number;
  type: PromotionType;
  /** Item / quantity_tiers / cart_threshold / buy_x filter scope. */
  scope?: PromotionScope;
  excludeCourseRefs?: DocumentReference[];
  excludeEbooks?: boolean;
  /** Bundle: courses that must all be present (owned counts). */
  courseRefs?: DocumentReference[];
  reward?: PromotionReward;
  tiers?: PromotionTier[];
  /** buy_x_get_y */
  buyCount?: number;
  buyScope?: PromotionScope;
  getCount?: number;
  getScope?: PromotionScope;
  getReward?: PromotionReward;
  getCheapest?: boolean;
  universityRefs?: DocumentReference[];
  branchRefs?: DocumentReference[];
  firstOrderOnly?: boolean;
  userRefs?: DocumentReference[];
  emailDomains?: string[];
  status?: PromotionStatus;
  startAt?: Timestamp | Date;
  endAt?: Timestamp | Date;
  totalUses?: number;
  perUserUses?: number;
  usageCount?: number;
  /** Null / empty = auto-apply. */
  code?: string | null;
  priority?: number;
  exclusive?: boolean;
  stackWithCoupon?: boolean;
  applyTo?: "item" | "cart";
  createdBy?: DocumentReference;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
};

/** Per-user usage of a promotion. Doc id: `{promoId}_{uid}`. */
export type PromotionUsageDoc = {
  promotionId: string;
  userRef: DocumentReference;
  count: number;
  lastOrderRef?: DocumentReference;
  updatedAt?: Timestamp | Date;
};

/**
 * `id` is always the Firestore document id. When the document also stores its
 * own `id` field (batches), the original is preserved as `sourceId`.
 */
export type WithId<T> = T & { id: string; refPath: string; sourceId?: unknown };
