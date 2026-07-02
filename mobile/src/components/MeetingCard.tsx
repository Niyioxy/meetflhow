import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MeetingSummary } from "@/types";

const PLATFORM_COLORS: Record<string, string> = {
  meet: "#34A853",
  teams: "#6264A7",
  zoom: "#2D8CFF",
  other: "#6B7280",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "–";
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#16A34A";
  if (score >= 60) return "#2563EB";
  if (score >= 40) return "#F59E0B";
  return "#DC2626";
}

interface Props {
  meeting: MeetingSummary;
  onPress: () => void;
  pending?: boolean;
}

export default function MeetingCard({ meeting, onPress, pending }: Props) {
  const platformColor = PLATFORM_COLORS[meeting.platform] ?? "#6B7280";
  const score = meeting.meetingScore?.overall;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 mb-3"
      activeOpacity={0.8}
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-white font-semibold text-sm flex-1 mr-2" numberOfLines={2}>
          {meeting.title}
        </Text>
        {score !== undefined && score !== null && (
          <View style={{ backgroundColor: scoreColor(score) + "22" }} className="px-2 py-0.5 rounded-full ml-2">
            <Text style={{ color: scoreColor(score) }} className="text-xs font-bold tabular-nums">
              {score}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View style={{ backgroundColor: platformColor + "22" }} className="px-2 py-0.5 rounded-full">
            <Text style={{ color: platformColor }} className="text-xs capitalize">{meeting.platform}</Text>
          </View>
          {meeting.durationSeconds && (
            <Text className="text-slate-500 text-xs">{formatDuration(meeting.durationSeconds)}</Text>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          {pending && (
            <View className="flex-row items-center gap-1 bg-amber-900/30 px-2 py-0.5 rounded-full">
              <Ionicons name="time-outline" size={11} color="#F59E0B" />
              <Text className="text-amber-400 text-xs">Pending sync</Text>
            </View>
          )}
          <Text className="text-slate-600 text-xs">
            {new Date(meeting.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Text>
        </View>
      </View>

      {meeting.summary && (
        <Text className="text-slate-500 text-xs mt-2 leading-4" numberOfLines={2}>
          {meeting.summary}
        </Text>
      )}
    </TouchableOpacity>
  );
}
