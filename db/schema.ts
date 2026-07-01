import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  primaryKey,
  unique,
  boolean,
  jsonb,
  date,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import { relations } from "drizzle-orm";
import type {
  MeetingCoachScore,
  SentimentTimeline,
  SpeakerSegment,
} from "@/types/analysis";
import type { AttendeeSalary, CalculatedCost } from "@/types/cost";
import type { InsightsCache } from "@/types/insights";

export const userRoleEnum = ["member", "manager", "admin"] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  role: text("role").$type<UserRole>().notNull().default("member"),
  insightsCache: jsonb("insights_cache").$type<InsightsCache>(),
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

export const workspacePlanEnum = ["free", "team"] as const;
export type WorkspacePlan = (typeof workspacePlanEnum)[number];

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  plan: text("plan").$type<WorkspacePlan>().notNull().default("free"),
  avatarColor: text("avatar_color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workspaceRoleEnum = ["owner", "admin", "member", "viewer"] as const;
export type WorkspaceRole = (typeof workspaceRoleEnum)[number];

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<WorkspaceRole>().notNull().default("member"),
    invitedBy: uuid("invited_by").references(() => users.id),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    unique("workspace_members_workspace_user_unique").on(
      table.workspaceId,
      table.userId
    ),
  ]
);

export const workspaceInvites = pgTable("workspace_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").$type<WorkspaceRole>().notNull().default("member"),
  token: text("token").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  sharedWithWorkspace: boolean("shared_with_workspace").notNull().default(false),
  title: text("title").notNull(),
  platform: text("platform").notNull().default("other"),
  durationSeconds: integer("duration_seconds"),
  status: text("status").$type<MeetingStatus>().notNull().default("uploading"),
  attendeeSalaries: jsonb("attendee_salaries").$type<AttendeeSalary[]>(),
  calculatedCost: jsonb("calculated_cost").$type<CalculatedCost>(),
  notionPageId: text("notion_page_id"),
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

export const issueTrackerProviderEnum = ["jira", "linear"] as const;
export type IssueTrackerProvider = (typeof issueTrackerProviderEnum)[number];

export const actionItems = pgTable("action_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  task: text("task").notNull(),
  owner: text("owner"),
  assigneeUserId: uuid("assignee_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  deadline: text("deadline"),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at"),
  priority: text("priority").$type<Priority>().notNull().default("medium"),
  status: text("status").$type<ActionItemStatus>().notNull().default("todo"),
  externalTicketId: text("external_ticket_id"),
  externalTicketUrl: text("external_ticket_url"),
  externalProvider: text("external_provider").$type<IssueTrackerProvider>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transcriptComments = pgTable("transcript_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  segmentIndex: integer("segment_index").notNull(),
  selectedText: text("selected_text").notNull(),
  comment: text("comment").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transcriptCommentReplies = pgTable("transcript_comment_replies", {
  id: uuid("id").defaultRandom().primaryKey(),
  commentId: uuid("comment_id")
    .notNull()
    .references(() => transcriptComments.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reply: text("reply").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mentionContextTypeEnum = [
  "action_item",
  "comment",
  "task",
  "todo",
] as const;
export type MentionContextType = (typeof mentionContextTypeEnum)[number];

export const mentions = pgTable("mentions", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromUserId: uuid("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  toUserId: uuid("to_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contextType: text("context_type").$type<MentionContextType>().notNull(),
  contextId: uuid("context_id").notNull(),
  contextText: text("context_text"),
  meetingId: uuid("meeting_id").references(() => meetings.id, {
    onDelete: "cascade",
  }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const meetingShares = pgTable("meeting_shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id),
  passwordHash: text("password_hash"),
  expiresAt: timestamp("expires_at"),
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at"),
  showTranscript: boolean("show_transcript").notNull().default(true),
  showActionItems: boolean("show_action_items").notNull().default(true),
  showCost: boolean("show_cost").notNull().default(false),
  showScore: boolean("show_score").notNull().default(true),
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
  externalTicketId: text("external_ticket_id"),
  externalTicketUrl: text("external_ticket_url"),
  externalProvider: text("external_provider").$type<IssueTrackerProvider>(),
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

export const slackIntegrations = pgTable("slack_integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  slackTeamId: text("slack_team_id").notNull(),
  slackTeamName: text("slack_team_name"),
  accessToken: text("access_token").notNull(),
  botUserId: text("bot_user_id"),
  defaultChannelId: text("default_channel_id"),
  defaultChannelName: text("default_channel_name"),
  connectedBy: uuid("connected_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [unique("slack_integrations_workspace_unique").on(table.workspaceId)]);

export const slackPostSettings = pgTable("slack_post_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  autoPostSummary: boolean("auto_post_summary").notNull().default(true),
  autoPostActionItems: boolean("auto_post_action_items").notNull().default(true),
  channelId: text("channel_id"),
  channelName: text("channel_name"),
}, (table) => [unique("slack_post_settings_workspace_unique").on(table.workspaceId)]);

export const notionIntegrations = pgTable("notion_integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  notionWorkspaceName: text("notion_workspace_name"),
  notionWorkspaceIcon: text("notion_workspace_icon"),
  databaseId: text("database_id"),
  databaseName: text("database_name"),
  connectedBy: uuid("connected_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [unique("notion_integrations_workspace_unique").on(table.workspaceId)]);

export const issueTrackerIntegrations = pgTable("issue_tracker_integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider").$type<IssueTrackerProvider>().notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  siteUrl: text("site_url"),
  siteName: text("site_name"),
  defaultProjectId: text("default_project_id"),
  defaultProjectName: text("default_project_name"),
  connectedBy: uuid("connected_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("issue_tracker_integrations_workspace_provider_unique").on(
    table.workspaceId,
    table.provider
  ),
]);

export const webhookStatusEnum = ["success", "failed"] as const;
export type WebhookStatus = (typeof webhookStatusEnum)[number];

export const webhookEventEnum = [
  "meeting.completed",
  "action_item.created",
  "action_item.completed",
  "meeting.scored",
  "task.created",
  "todo.created",
] as const;
export type WebhookEvent = (typeof webhookEventEnum)[number];

export const webhooks = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: text("events").array().$type<WebhookEvent[]>().notNull(),
  secret: text("secret").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastStatus: text("last_status").$type<WebhookStatus>(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").$type<WebhookEvent>().notNull(),
  payload: jsonb("payload"),
  responseStatus: integer("response_status"),
  success: boolean("success").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const extensionTokens = pgTable("extension_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  name: text("name").notNull().default("Chrome Extension"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  meetings: many(meetings),
  scheduledMeetings: many(scheduledMeetings),
  tasks: many(tasks),
  todos: many(todos),
  ownedWorkspaces: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  user: one(users, { fields: [meetings.userId], references: [users.id] }),
  workspace: one(workspaces, {
    fields: [meetings.workspaceId],
    references: [workspaces.id],
  }),
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
  comments: many(transcriptComments),
  shares: many(meetingShares),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  invites: many(workspaceInvites),
  meetings: many(meetings),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const workspaceInvitesRelations = relations(workspaceInvites, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvites.workspaceId],
    references: [workspaces.id],
  }),
}));

export const transcriptCommentsRelations = relations(transcriptComments, ({ one, many }) => ({
  meeting: one(meetings, {
    fields: [transcriptComments.meetingId],
    references: [meetings.id],
  }),
  user: one(users, { fields: [transcriptComments.userId], references: [users.id] }),
  replies: many(transcriptCommentReplies),
}));

export const transcriptCommentRepliesRelations = relations(
  transcriptCommentReplies,
  ({ one }) => ({
    comment: one(transcriptComments, {
      fields: [transcriptCommentReplies.commentId],
      references: [transcriptComments.id],
    }),
    user: one(users, { fields: [transcriptCommentReplies.userId], references: [users.id] }),
  })
);

export const mentionsRelations = relations(mentions, ({ one }) => ({
  fromUser: one(users, { fields: [mentions.fromUserId], references: [users.id] }),
  toUser: one(users, { fields: [mentions.toUserId], references: [users.id] }),
  meeting: one(meetings, { fields: [mentions.meetingId], references: [meetings.id] }),
}));

export const meetingSharesRelations = relations(meetingShares, ({ one }) => ({
  meeting: one(meetings, { fields: [meetingShares.meetingId], references: [meetings.id] }),
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
  assignee: one(users, {
    fields: [actionItems.assigneeUserId],
    references: [users.id],
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

export const slackIntegrationsRelations = relations(slackIntegrations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [slackIntegrations.workspaceId],
    references: [workspaces.id],
  }),
}));

export const notionIntegrationsRelations = relations(notionIntegrations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [notionIntegrations.workspaceId],
    references: [workspaces.id],
  }),
}));

export const issueTrackerIntegrationsRelations = relations(
  issueTrackerIntegrations,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [issueTrackerIntegrations.workspaceId],
      references: [workspaces.id],
    }),
  })
);

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [webhooks.workspaceId],
    references: [workspaces.id],
  }),
  logs: many(webhookLogs),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookLogs.webhookId],
    references: [webhooks.id],
  }),
}));

export const extensionTokensRelations = relations(extensionTokens, ({ one }) => ({
  user: one(users, { fields: [extensionTokens.userId], references: [users.id] }),
}));
