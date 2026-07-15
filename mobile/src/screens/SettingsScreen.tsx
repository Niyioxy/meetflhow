import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Switch, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useAuthStore } from "@/store/authStore";
import { getOfflineStorageInfo, clearAllPending } from "@/lib/offline";
import { syncOfflineRecordings } from "@/lib/sync";
import { isOnline } from "@/lib/offline";

const VOICE_COMMANDS_REF = [
  "Hey MeetFlhow, start recording",
  "Hey MeetFlhow, stop recording",
  "Hey MeetFlhow, pause",
  "Hey MeetFlhow, open meetings",
  "Hey MeetFlhow, open tasks",
  "Hey MeetFlhow, what's my score",
  "Hey MeetFlhow, add task [text]",
];

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [offlineInfo, setOfflineInfo] = useState({ pendingCount: 0, totalMb: "–" });
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    getOfflineStorageInfo().then(setOfflineInfo);
    isOnline().then(setOnline);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const { synced, failed } = await syncOfflineRecordings();
    setSyncing(false);
    const info = await getOfflineStorageInfo();
    setOfflineInfo(info);
    Alert.alert("Sync complete", `${synced} synced, ${failed} failed.`);
  };

  const handleClearPending = () => {
    Alert.alert("Clear all pending?", "This will delete all unsynced recordings. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete all",
        style: "destructive",
        onPress: async () => {
          await clearAllPending();
          setOfflineInfo({ pendingCount: 0, totalMb: "–" });
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <SafeAreaView className="flex-1 bg-[#0A0F1E]">
      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="text-white text-2xl font-bold mb-6">Settings</Text>

        <View className="bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 mb-4 flex-row items-center gap-3">
          <View className="w-12 h-12 rounded-full bg-[#2563EB] items-center justify-center">
            <Text className="text-white text-lg font-bold">{user?.name?.[0]?.toUpperCase() ?? "M"}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold">{user?.name ?? "MeetFlhow User"}</Text>
            <Text className="text-slate-400 text-sm">{user?.email}</Text>
          </View>
        </View>

        <SectionHeader title="Account" />
        <SettingsRow icon="lock-closed-outline" label="Change password" onPress={() => {}} />
        <SettingsRow icon="log-out-outline" label="Sign out" onPress={handleSignOut} danger />

        <SectionHeader title="Voice Commands" />
        <View className="bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 mb-1">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-3">
              <Ionicons name="mic-outline" size={20} color="#9CA3AF" />
              <Text className="text-white text-sm">Enable Voice Commands</Text>
            </View>
            <Switch
              value={voiceEnabled}
              onValueChange={setVoiceEnabled}
              trackColor={{ false: "#374151", true: "#2563EB" }}
              thumbColor="#fff"
            />
          </View>
          {voiceEnabled && (
            <View className="mt-2 border-t border-[#1E293B] pt-3">
              <Text className="text-slate-400 text-xs mb-2">Available commands:</Text>
              {VOICE_COMMANDS_REF.map((cmd, i) => (
                <Text key={i} className="text-slate-500 text-xs mb-1">• {cmd}</Text>
              ))}
            </View>
          )}
        </View>

        <SectionHeader title="Offline Storage" />
        <View className="bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 mb-1">
          <View className="flex-row justify-between mb-3">
            <Text className="text-slate-400 text-sm">Pending recordings</Text>
            <Text className="text-white text-sm font-semibold">{offlineInfo.pendingCount}</Text>
          </View>
          <View className="flex-row justify-between mb-4">
            <Text className="text-slate-400 text-sm">Storage used</Text>
            <Text className="text-white text-sm font-semibold">{offlineInfo.totalMb} MB</Text>
          </View>
          <TouchableOpacity
            onPress={handleSync}
            disabled={syncing || !online || offlineInfo.pendingCount === 0}
            className="bg-[#2563EB] rounded-xl py-2.5 items-center mb-2 disabled:opacity-40"
            activeOpacity={0.8}
          >
            <Text className="text-white font-medium text-sm">
              {syncing ? "Syncing..." : "Sync Now"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClearPending}
            disabled={offlineInfo.pendingCount === 0}
            className="border border-[#DC2626] rounded-xl py-2.5 items-center disabled:opacity-40"
            activeOpacity={0.8}
          >
            <Text className="text-red-400 font-medium text-sm">Clear all pending</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="About" />
        <View className="bg-[#1A2236] border border-[#1E293B] rounded-2xl p-4 mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-slate-400 text-sm">Version</Text>
            <Text className="text-white text-sm">{version}</Text>
          </View>
          <Text className="text-slate-500 text-xs">Powered by MeetFlhow</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2 mt-4 px-1">
      {title}
    </Text>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-[#1A2236] border border-[#1E293B] rounded-2xl px-4 py-3.5 mb-2 flex-row items-center justify-between"
      activeOpacity={0.8}
    >
      <View className="flex-row items-center gap-3">
        <Ionicons name={icon as "mic"} size={18} color={danger ? "#EF4444" : "#9CA3AF"} />
        <Text className={`text-sm ${danger ? "text-red-400" : "text-white"}`}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#4B5563" />
    </TouchableOpacity>
  );
}
