import React from "react";
import { View, Text, ScrollView, TouchableOpacity, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import MeetingCard from "@/components/MeetingCard";
import OfflineBanner from "@/components/OfflineBanner";
import type { HomeStackParamList } from "@/types";

type Nav = StackNavigationProp<HomeStackParamList, "HomeScreen">;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["meetings", 1],
    queryFn: () => api.meetings.list(1, 5),
  });

  const meetings = data?.data ?? [];
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const stats = [
    { label: "This week", value: meetings.length.toString(), sub: "meetings" },
    {
      label: "Hours recorded",
      value: Math.round(meetings.reduce((s, m) => s + (m.durationSeconds ?? 0), 0) / 3600).toString(),
      sub: "hrs",
    },
    { label: "Tasks due", value: "–", sub: "today" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#0A0F1E]">
      <OfflineBanner />
      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
      >
        <View className="mt-4 mb-6">
          <Text className="text-white text-2xl font-bold">
            {greeting()}, {firstName} 👋
          </Text>
          <Text className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-1">
          {stats.map((s) => (
            <View key={s.label} className="bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 mr-3 min-w-[110px]">
              <Text className="text-blue-400 text-2xl font-bold tabular-nums">{s.value}</Text>
              <Text className="text-slate-400 text-xs mt-1">{s.sub}</Text>
              <Text className="text-slate-500 text-xs">{s.label}</Text>
            </View>
          ))}
        </ScrollView>

        <Text className="text-white font-semibold text-base mb-3">Recent Meetings</Text>

        {meetings.length === 0 ? (
          <View className="bg-[#1A2236] border border-[#1E293B] rounded-2xl p-8 items-center">
            <Ionicons name="mic-outline" size={40} color="#4B5563" />
            <Text className="text-slate-400 mt-3 text-sm text-center">
              No meetings yet. Tap the mic button to record your first meeting.
            </Text>
          </View>
        ) : (
          meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              onPress={() => navigation.navigate("MeetingDetail", { meetingId: m.id })}
            />
          ))
        )}

        <Text className="text-white font-semibold text-base mt-6 mb-3">Quick Actions</Text>
        <View className="flex-row gap-3 mb-8">
          <TouchableOpacity
            className="flex-1 bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 items-center"
            activeOpacity={0.8}
          >
            <Ionicons name="mic" size={22} color="#2563EB" />
            <Text className="text-white text-xs mt-2 text-center">Record Meeting</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 items-center"
            activeOpacity={0.8}
          >
            <Ionicons name="folder-open-outline" size={22} color="#2563EB" />
            <Text className="text-white text-xs mt-2 text-center">Upload Audio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 items-center"
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={22} color="#2563EB" />
            <Text className="text-white text-xs mt-2 text-center">Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
