/** Exact Firestore collection IDs from Flutter schema. Do not rename. */
export const collections = {
  users: "users",
  course: "course",
  courseOthers: "courseOthers",
  chapter: "chapter",
  lessons: "lessons",
  orders: "orders",
  orderHistory: "orderHistory",
  review: "review",
  videos: "videos",
  folder: "folder",
  coupon: "coupon",
  batches: "batches",
  university: "university",
  country: "country",
  branch: "branch",
  category: "category",
  settings: "settings",
  sessions: "sessions",
  activityLog: "activityLog",
  smsMarket: "smsMarket",
  userdeviceinfo: "userdeviceinfo",
  userCart: "userCart",
  subscription: "subscription",
  instructorUserRequest: "instructorUserRequest",
  transactionOrderBar: "transactionOrderBar",
  bugreport: "bugreport",
  mail: "mail",
  template: "template",
  alert_subscriber: "alert_subscriber",
  manual_alert_subscriber: "manual_alert_subscriber",
  id_map: "id_map",
  /** New in the React admin: installment reminder groups. */
  emiSchedule: "emiSchedule",
  /** New in the React admin: one record per Cloudflare upload. */
  mediaAsset: "mediaAsset",
  /** New in the React admin: folder tree for the Media explorer. */
  mediaFolders: "mediaFolders",
  /** Client-visible upload job progress (VdoCipher resumable staging). */
  mediaUploads: "mediaUploads",
  /** New in the React admin: panel RBAC role definitions. */
  roles: "roles",
  /** New in the React admin: one row per eBook file download by a buyer. */
  ebookDownloads: "ebookDownloads",
  /** Payments v2: per-installment ledger. */
  installments: "installments",
  /** Payments v2: single-chapter purchase access. */
  chapterAccess: "chapterAccess",
  /** Payments v2: eBook purchase access. */
  ebookAccess: "ebookAccess",
  /** Payments v2: EMI reminder cron log. */
  emiReminders: "emiReminders",
  /** FlutterFlow FCM push queue (Cloud Function trigger). */
  ff_push_notifications: "ff_push_notifications",
  /** Super-admin config docs (media provider, BSFL counters, …). */
  adminConfig: "adminConfig",
  /** Dynamic pricing / bundles / BOGO rules (Promotions module). */
  promotions: "promotions",
  /** Per-user promotion usage counters (`{promoId}_{uid}`). */
  promotionUsage: "promotionUsage",
  /** Course outline tests (MCQ). Public questions; answer key is separate. */
  quiz: "quiz",
  /** Files placed directly in a course outline. */
  courseResources: "courseResources",
  /** Staff-only correct option indexes, keyed by quizId. */
  quizAnswerKey: "quizAnswerKey",
  /** Latest score per student per quiz (`{quizId}_{uid}`). */
  quizResult: "quizResult",
  /** Student web: last position per lesson (`{uid}_{lessonId}`). */
  watchProgress: "watchProgress",
  /** Student web: streak and study time. */
  userStats: "userStats",
  /** Student web: hashed WhatsApp/SMS OTP. */
  otpRequests: "otpRequests",
  /** Student web: hashed single-use sign-in links minted by admins. */
  signInLinks: "signInLinks",
  /** Student web: account-sharing flags. */
  deviceFlags: "deviceFlags",
  /** Student web: generated invoice PDFs. */
  invoices: "invoices",
  /** Playback analytics written by the student app's /api/analytics/video. */
  videoSessions: "videoSessions",
  videoStats: "videoStats",
  courseStats: "courseStats",
  videoDaily: "videoDaily",
} as const;
