import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import ScoreDial from "@/components/ScoreDial";
import type { MeetingsStackParamList, ActionItem } from "@/types";

type Route = RouteProp<MeetingsStackParamList, "MeetingDetail">;

const TABS = ["Summary", "Action Items", "Transcript", "Score"] as const;
type Tab = (typeof TABS)[number];

const PLATFORM_COLORS: Record<string, string> = {
  meet: "#34A853",
  teams: "#6264A7",
  zoom: "#2D8CFF",
  other: "#6B7280",
};

const SENTIMENT_COLORS = { positive: "#16A34A", neutral: "#2563EB", tense: "#DC2626" };

export default function MeetingDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { meetingId } = route.params;
  const [activeTab, setActiveTab] = useState<Tab>("Summary");

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: () => api.meetings.get(meetingId),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0F1E] items-center justify-center">
        <ActivityIndicator color="#2563EB" size="large" />
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0F1E] items-center justify-center px-6">
        <Text className="text-slate-400">Meeting not found.</Text>
      </SafeAreaView>
    );
  }

  const platformColor = PLATFORM_COLORS[meeting.platform] ?? "#6B7280";
  const score = meeting.analysis?.meetingScore?.overall;

  return (
    <SafeAreaView className="flex-1 bg-[#0A0F1E]">
      <View className="flex-row items-center px-4 pt-2 pb-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="chevron-back" size={24} color="#F9FAFB" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white font-bold text-lg" numberOfLines={1}>{meeting.title}</Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            <View style={{ backgroundColor: platformColor + "33" }} className="px-2 py-0.5 rounded-full">
              <Text style={{ color: platformColor }} className="text-xs font-medium capitalize">{meeting.platform}</Text>
            </View>
            <Text className="text-slate-500 text-xs">
              {new Date(meeting.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row px-4 mb-2 gap-1">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? "bg-[#2563EB]" : "bg-[#1A2236]"}`}
          >
            <Text className={`text-xs font-medium ${activeTab === tab ? "text-white" : "text-slate-400"}`}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="flex-1 px-4">
        {activeTab === "Summary" && (
          <View className="mt-2">
            {meeting.analysis?.sentiment && (
              <View className="flex-row items-center gap-2 mb-4">
                <View style={{ backgroundColor: SENTIMENT_COLORS[meeting.analysis.sentiment] + "22" }} className="px-3 py-1 rounded-full flex-row items-center gap-1">
                  <Ionicons
                    name={meeting.analysis.sentiment === "positive" ? "happy-outline" : meeting.analysis.sentiment === "tense" ? "sad-outline" : "remove-outline"}
                    size={14}
                    color={SENTIMENT_COLORS[meeting.analysis.sentiment]}
                  />
                  <Text style={{ color: SENTIMENT_COLORS[meeting.analysis.sentiment] }} className="text-xs font-medium capitalize">
                    {meeting.analysis.sentiment}
                  </Text>
                </View>
              </View>
            )}
            <Text className="text-slate-400 text-sm leading-6 mb-6">
              {meeting.analysis?.summary ?? "Analysis not yet available."}
            </Text>
            {(meeting.analysis?.decisions?.length ?? 0) > 0 && (
              <>
                <Text className="text-white font-semibold mb-3">Key Decisions</Text>
                {meeting.analysis!.decisions.map((d, i) => (
                  <View key={i} className="flex-row gap-3 mb-2">
                    <Text className="text-blue-400">•</Text>
                    <Text className="text-slate-400 text-sm flex-1">{d}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {activeTab === "Action Items" && (
          <View className="mt-2">
            {meeting.actionItems.length === 0 ? (
              <Text className="text-slate-500 text-sm text-center mt-8">No action items found.</Text>
            ) : (
              meeting.actionItems.map((item: ActionItem) => (
                <View key={item.id} className="bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 mb-3">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <Text className={`text-sm font-medium ${item.status === "done" ? "line-through text-slate-500" : "text-white"}`}>
                        {item.task}
                      </Text>
                      {item.owner && <Text className="text-slate-400 text-xs mt-1">👤 {item.owner}</Text>}
                      {item.deadline && <Text className="text-slate-400 text-xs">📅 {item.deadline}</Text>}
                    </View>
                    <View className={`px-2 py-0.5 rounded-full ${item.priority === "high" ? "bg-red-900/40" : item.priority === "medium" ? "bg-yellow-900/40" : "bg-green-900/40"}`}>
                      <Text className={`text-xs ${item.priority === "high" ? "text-red-400" : item.priority === "medium" ? "text-yellow-400" : "text-green-400"}`}>
                        {item.priority}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "Transcript" && (
          <View className="mt-2">
            {!meeting.transcript ? (
              <Text className="text-slate-500 text-sm text-center mt-8">Transcript not available.</Text>
            ) : meeting.transcript.speakerSegments ? (
              meeting.transcript.speakerSegments.map((seg, i) => (
                <View key={i} className="mb-4">
                  <Text className="text-blue-400 text-xs font-semibold mb-1">{seg.speaker}</Text>
                  <Text className="text-slate-300 text-sm leading-6">{seg.text}</Text>
                </View>
              ))
            ) : (
              <Text className="text-slate-400 text-sm leading-6">{meeting.transcript.fullText}</Text>
            )}
          </View>
        )}

        {activeTab === "Score" && (
          <View className="mt-6 items-center">
            {score !== undefined && score !== null ? (
              <>
                <ScoreDial score={score} />
                <Text className="text-white text-2xl font-bold mt-4">{score}/100</Text>
                <Text className="text-slate-400 text-sm mt-1">Meeting Quality Score</Text>
                {meeting.analysis?.meetingScore?.categories && (
                  <View className="w-full mt-6">
                    {Object.entries(meeting.analysis.meetingScore.categories).map(([k, v]) => (
                      <View key={k} className="flex-row items-center justify-between mb-3">
                        <Text className="text-slate-400 text-sm capitalize">{k.replace(/_/g, " ")}</Text>
                        <View className="flex-row items-center gap-2">
                          <View className="w-24 h-2 bg-[#1E293B] rounded-full overflow-hidden">
                            <View style={{ width: `${v}%`, backgroundColor: "#2563EB" }} className="h-full rounded-full" />
                          </View>
                          <Text className="text-blue-400 text-xs tabular-nums w-8 text-right">{v}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text className="text-slate-500 text-sm mt-8">Score not available yet.</Text>
            )}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
