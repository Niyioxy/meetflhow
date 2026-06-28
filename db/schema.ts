import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  primaryKey,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import { relations } from "drizzle-orm";
import type {
  MeetingCoachScore,
  SentimentTimeline,
  SpeakerSegment,
} from "@/types/analysis";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
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
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

export const meetingStatusEnum = [
  "uploading",
  "transcribing",
  "analyzing",
  "ready",
  "failed",
] as const;
export type MeetingStatus = (typeof meetingStatusEnum)[number];

export const meetings = pgTable("meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  platform: text("platform").notNull().default("other"),
  durationSeconds: integer("duration_seconds"),
  status: text("status").$type<MeetingStatus>().notNull().default("uploading"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transcripts = pgTable("transcripts", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  fullText: text("full_text").notNull(),
  language: text("language"),
  wordCount: integer("word_count").notNull().default(0),
  speakerSegments: jsonb("speaker_segments").$type<SpeakerSegment[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const priorityEnum = ["high", "medium", "low"] as const;
export type Priority = (typeof priorityEnum)[number];

export const actionItemStatusEnum = ["todo", "done"] as const;
export type ActionItemStatus = (typeof actionItemStatusEnum)[number];

export const actionItems = pgTable("action_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  task: text("task").notNull(),
  owner: text("owner"),
  deadline: text("deadline"),
  priority: text("priority").$type<Priority>().notNull().default("medium"),
  status: text("status").$type<ActionItemStatus>().notNull().default("todo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sentimentEnum = ["positive", "neutral", "tense"] as const;
export type Sentiment = (typeof sentimentEnum)[number];

export const analysis = pgTable("analysis", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  decisions: text("decisions").array().notNull().default([]),
  openQuestions: text("open_questions").array().notNull().default([]),
  sentiment: text("sentiment").$type<Sentiment>().notNull().default("neutral"),
  meetingScore: jsonb("meeting_score").$type<MeetingCoachScore>(),
  sentimentTimeline: jsonb("sentiment_timeline").$type<SentimentTimeline>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scheduledMeetingPlatformEnum = [
  "Google Meet",
  "Microsoft Teams",
  "Zoom",
] as const;
export type ScheduledMeetingPlatform =
  (typeof scheduledMeetingPlatformEnum)[number];

export const scheduledMeetings = pgTable("scheduled_meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  platform: text("platform").$type<ScheduledMeetingPlatform>().notNull().default("Google Meet"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  attendees: text("attendees").array().notNull().default([]),
  meetLink: text("meet_link"),
  notes: text("notes"),
  googleEventId: text("google_event_id"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskStatusEnum = [
  "backlog",
  "in_progress",
  "in_review",
  "done",
] as const;
export type TaskStatus = (typeof taskStatusEnum)[number];

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  meetingId: uuid("meeting_id").references(() => meetings.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").$type<Priority>().notNull().default("medium"),
  status: text("status").$type<TaskStatus>().notNull().default("backlog"),
  dueDate: timestamp("due_date"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scheduledFollowUpEmails = pgTable("scheduled_follow_up_emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  recipients: text("recipients").array().notNull().default([]),
  replyTo: text("reply_to"),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  sendAt: timestamp("send_at").notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const todos = pgTable("todos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes"),
  priority: text("priority").$type<Priority>().notNull().default("medium"),
  dueDate: timestamp("due_date"),
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  meetings: many(meetings),
  scheduledMeetings: many(scheduledMeetings),
  tasks: many(tasks),
  todos: many(todos),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  user: one(users, { fields: [meetings.userId], references: [users.id] }),
  transcript: one(transcripts, {
    fields: [meetings.id],
    references: [transcripts.meetingId],
  }),
  actionItems: many(actionItems),
  analysis: one(analysis, {
    fields: [meetings.id],
    references: [analysis.meetingId],
  }),
  tasks: many(tasks),
}));

export const scheduledMeetingsRelations = relations(scheduledMeetings, ({ one }) => ({
  user: one(users, { fields: [scheduledMeetings.userId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  meeting: one(meetings, { fields: [tasks.meetingId], references: [meetings.id] }),
}));

export const todosRelations = relations(todos, ({ one }) => ({
  user: one(users, { fields: [todos.userId], references: [users.id] }),
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  meeting: one(meetings, {
    fields: [transcripts.meetingId],
    references: [meetings.id],
  }),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  meeting: one(meetings, {
    fields: [actionItems.meetingId],
    references: [meetings.id],
  }),
}));

export const analysisRelations = relations(analysis, ({ one }) => ({
  meeting: one(meetings, {
    fields: [analysis.meetingId],
    references: [meetings.id],
  }),
}));

export const scheduledFollowUpEmailsRelations = relations(
  scheduledFollowUpEmails,
  ({ one }) => ({
    meeting: one(meetings, {
      fields: [scheduledFollowUpEmails.meetingId],
      references: [meetings.id],
    }),
  })
);
