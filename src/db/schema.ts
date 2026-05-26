import {
  boolean,
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  date,
  doublePrecision,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core"
import type { AdapterAccount } from "next-auth/adapters"

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
  // App specific user preferences
  calcMethod: integer("calcMethod").default(1), // Karachi (University of Islamic Sciences) by default
  timezone: text("timezone"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  trackWitr: boolean("trackWitr").default(false).notNull(),
  asrMethod: integer("asrMethod").default(0).notNull(), // 0 = Standard (Shafi'i/Maliki/Hanbali), 1 = Hanafi
  qazaPace: text("qazaPace"), // JSON string
  excusedRanges: text("excusedRanges"), // JSON string
  dayCheckinEnabled: boolean("dayCheckinEnabled").default(true).notNull(),
  nightSummaryEnabled: boolean("nightSummaryEnabled").default(true).notNull(),
  lastAutoBackfillDate: date("lastAutoBackfillDate"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
})

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
)

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
    attempts: integer("attempts").default(0).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
)

export const rateLimits = pgTable(
  "rate_limit",
  {
    key: text("key").primaryKey(),
    count: integer("count").default(0).notNull(),
    resetAt: timestamp("resetAt", { mode: "date" }).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("rate_limit_reset_at_idx").on(table.resetAt),
  ]
)

// Qaza Tracker specific tables

export const prayerNames = ["fajr", "dhuhr", "asr", "maghrib", "isha", "witr"] as const;

export const prayerLogs = pgTable(
  "prayer_log",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // YYYY-MM-DD
    prayerName: text("prayerName").notNull(), // fajr, dhuhr, etc.
    status: text("status").notNull(), // completed, missed, qaza_completed, excused
    completedAt: timestamp("completedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("prayer_log_user_date_prayer_unique").on(table.userId, table.date, table.prayerName),
    index("prayer_log_user_date_idx").on(table.userId, table.date),
    index("prayer_log_user_status_idx").on(table.userId, table.status),
  ]
);

export const qazaItems = pgTable(
  "qaza_item",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    prayerName: text("prayerName").notNull(),
    dateMissed: date("dateMissed"), // null if it's from the bulk onboarding estimate
    isCompleted: boolean("isCompleted").default(false).notNull(),
    completedAt: timestamp("completedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("qaza_item_user_date_prayer_unique").on(table.userId, table.dateMissed, table.prayerName),
    index("qaza_item_user_completed_idx").on(table.userId, table.isCompleted),
    index("qaza_item_user_prayer_idx").on(table.userId, table.prayerName),
  ]
);

export const pushSubscriptions = pgTable(
  "push_subscription",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("push_subscription_user_endpoint_unique").on(table.userId, table.endpoint),
    index("push_subscription_user_idx").on(table.userId),
  ]
);

export const notificationLogs = pgTable(
  "notification_log",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    uniqueKey: text("uniqueKey").notNull().unique(), // e.g. "userId:2026-05-24:day_checkin:fajr"
    type: text("type").notNull(), // "day_checkin", "night_summary"
    sentAt: timestamp("sentAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("notification_log_user_type_idx").on(table.userId, table.type),
  ]
);
