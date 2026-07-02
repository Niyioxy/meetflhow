import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Task } from "@/types";

const PRIORITY_COLORS = {
  high: { bg: "bg-red-900/30", text: "text-red-400", dot: "#EF4444" },
  medium: { bg: "bg-yellow-900/30", text: "text-yellow-400", dot: "#F59E0B" },
  low: { bg: "bg-green-900/30", text: "text-green-400", dot: "#16A34A" },
};

interface Props {
  task: Task;
  onComplete: () => void;
}

export default function TaskItem({ task, onComplete }: Props) {
  const isDone = task.status === "done";
  const p = PRIORITY_COLORS[task.priority];

  return (
    <TouchableOpacity
      className="bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 mb-3 flex-row items-start gap-3"
      activeOpacity={0.85}
      onPress={onComplete}
    >
      <View
        style={{ borderColor: isDone ? "#16A34A" : "#374151", backgroundColor: isDone ? "#16A34A22" : "transparent" }}
        className="w-6 h-6 rounded-full border-2 items-center justify-center mt-0.5"
      >
        {isDone && <Ionicons name="checkmark" size={14} color="#16A34A" />}
      </View>

      <View className="flex-1">
        <Text className={`text-sm font-medium ${isDone ? "line-through text-slate-500" : "text-white"}`}>
          {task.title}
        </Text>
        {task.description && (
          <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>{task.description}</Text>
        )}
        <View className="flex-row items-center gap-2 mt-2">
          <View className={`${p.bg} px-2 py-0.5 rounded-full`}>
            <Text className={`${p.text} text-xs capitalize`}>{task.priority}</Text>
          </View>
          {task.dueDate && (
            <Text className="text-slate-500 text-xs">
              📅 {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          )}
          <View className="flex-1 items-end">
            <View
              style={{
                backgroundColor:
                  task.status === "done" ? "#16A34A33" :
                  task.status === "in_progress" ? "#2563EB33" :
                  task.status === "in_review" ? "#F59E0B33" : "#37415133",
              }}
              className="px-2 py-0.5 rounded-full"
            >
              <Text
                style={{
                  color:
                    task.status === "done" ? "#16A34A" :
                    task.status === "in_progress" ? "#60A5FA" :
                    task.status === "in_review" ? "#F59E0B" : "#6B7280",
                }}
                className="text-xs capitalize"
              >
                {task.status.replace("_", " ")}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
