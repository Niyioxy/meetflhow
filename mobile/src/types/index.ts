export type Priority = "high" | "medium" | "low";
export type MeetingStatus = "uploading" | "transcribing" | "analyzing" | "ready" | "failed";
export type TaskStatus = "backlog" | "in_progress" | "in_review" | "done";
export type Sentiment = "positive" | "neutral" | "tense";

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
}

export interface MeetingScore {
  overall: number;
  categories?: Record<string, number>;
}

export interface SpeakerSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface MeetingSummary {
  id: string;
  title: string;
  platform: string;
  status: MeetingStatus;
  durationSeconds: number | null;
  createdAt: string;
  summary: string | null;
  sentiment: Sentiment | null;
  meetingScore: MeetingScore | null;
}

export interface MeetingAnalysis {
  summary: string;
  decisions: string[];
  openQuestions: string[];
  sentiment: Sentiment;
  meetingScore: MeetingScore | null;
  sentimentTimeline: unknown | null;
}

export interface ActionItem {
  id: string;
  task: string;
  owner: string | null;
  deadline: string | null;
  priority: Priority;
  status: "todo" | "done";
  completedAt: string | null;
}

export interface MeetingDetail extends MeetingSummary {
  transcript: {
    fullText: string;
    speakerSegments: SpeakerSegment[] | null;
    wordCount: number;
    language: string | null;
  } | null;
  analysis: MeetingAnalysis | null;
  actionItems: ActionItem[];
}

export interface Task {
  id: string;
  userId: string;
  meetingId: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  assignedTo: string | null;
  createdAt: string;
}

export interface Todo {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  priority: Priority;
  dueDate: string | null;
  isComplete: boolean;
  createdAt: string;
}

export interface OfflineRecording {
  id: string;
  title: string;
  platform: string;
  recorded_at: string;
  duration: number;
  file_path: string;
  synced: boolean;
}

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type TabParamList = {
  Home: undefined;
  Meetings: undefined;
  Record: undefined;
  Tasks: undefined;
  Settings: undefined;
};

export type HomeStackParamList = {
  HomeScreen: undefined;
  MeetingDetail: { meetingId: string };
};

export type MeetingsStackParamList = {
  MeetingsList: undefined;
  MeetingDetail: { meetingId: string };
  Transcript: { meetingId: string };
};
