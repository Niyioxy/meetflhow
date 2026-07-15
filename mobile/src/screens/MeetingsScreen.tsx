import React, { useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import MeetingCard from "@/components/MeetingCard";
import OfflineBanner from "@/components/OfflineBanner";
import type { MeetingsStackParamList, MeetingSummary } from "@/types";

type Nav = StackNavigationProp<MeetingsStackParamList, "MeetingsList">;

const FILTERS = ["All", "This Week", "Scored"] as const;
type Filter = (typeof FILTERS)[number];

function inThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return d >= weekAgo;
}

export default function MeetingsScreen() {
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching, isLoading } =
    useInfiniteQuery({
      queryKey: ["meetings-list"],
      queryFn: ({ pageParam = 1 }) => api.meetings.list(pageParam as number, 20),
      getNextPageParam: (last) =>
        last.data.length === last.limit ? last.page + 1 : undefined,
      initialPageParam: 1,
    });

  const allMeetings: MeetingSummary[] = data?.pages.flatMap((p) => p.data) ?? [];

  const filtered = allMeetings.filter((m) => {
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "All"
        ? true
        : filter === "This Week"
        ? inThisWeek(m.createdAt)
        : filter === "Scored"
        ? !!m.meetingScore
        : true;
    return matchSearch && matchFilter;
  });

  return (
    <SafeAreaView className="flex-1 bg-[#0A0F1E]">
      <OfflineBanner />
      <View className="px-4 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-3">Meetings</Text>
        <View className="bg-[#1A2236] border border-[#1E293B] rounded-xl flex-row items-center px-3 mb-3">
          <Ionicons name="search-outline" size={18} color="#4B5563" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search meetings..."
            placeholderTextColor="#4B5563"
            className="flex-1 text-white py-3 px-2 text-sm"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#4B5563" />
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row gap-2">
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full border ${
                filter === f ? "bg-[#2563EB] border-[#2563EB]" : "border-[#1E293B] bg-transparent"
              }`}
            >
              <Text className={`text-xs font-medium ${filter === f ? "text-white" : "text-slate-400"}`}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#2563EB" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Ionicons name="mic-off-outline" size={40} color="#374151" />
              <Text className="text-slate-500 mt-3 text-sm">No meetings found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MeetingCard
              meeting={item}
              onPress={() => navigation.navigate("MeetingDetail", { meetingId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
