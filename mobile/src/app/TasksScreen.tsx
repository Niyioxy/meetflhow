import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import TaskItem from "@/components/TaskItem";
import type { Task } from "@/types";

const SEGMENTS = ["All", "Today", "Overdue"] as const;
type Segment = (typeof SEGMENTS)[number];

function isToday(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function TasksScreen() {
  const [segment, setSegment] = useState<Segment>("All");
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching, isLoading } =
    useInfiniteQuery({
      queryKey: ["tasks-list"],
      queryFn: ({ pageParam = 1 }) => api.tasks.list(pageParam as number, 30),
      getNextPageParam: (last) => (last.data.length === last.limit ? last.page + 1 : undefined),
      initialPageParam: 1,
    });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => api.tasks.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks-list"] }),
  });

  const allTasks: Task[] = data?.pages.flatMap((p) => p.data) ?? [];

  const filtered = allTasks.filter((t) => {
    if (segment === "Today") return isToday(t.dueDate);
    if (segment === "Overdue") return isOverdue(t.dueDate) && t.status !== "done";
    return true;
  });

  const handleComplete = (task: Task) => {
    updateMutation.mutate({ id: task.id, data: { status: task.status === "done" ? "backlog" : "done" } });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0F1E]">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-4">Tasks</Text>
        <View className="flex-row gap-2 bg-[#111827] p-1 rounded-xl">
          {SEGMENTS.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSegment(s)}
              className={`flex-1 py-2 rounded-lg items-center ${segment === s ? "bg-[#2563EB]" : ""}`}
            >
              <Text className={`text-sm font-medium ${segment === s ? "text-white" : "text-slate-400"}`}>
                {s}
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
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#2563EB" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Ionicons name="checkmark-done-circle-outline" size={40} color="#374151" />
              <Text className="text-slate-500 mt-3 text-sm">
                {segment === "Today" ? "No tasks due today" : segment === "Overdue" ? "No overdue tasks" : "No tasks yet"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TaskItem task={item} onComplete={() => handleComplete(item)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}
