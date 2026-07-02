import React from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useRecordingStore } from "@/store/recordingStore";
import { useRecording } from "@/hooks/useRecording";
import AudioWaveform from "@/components/AudioWaveform";
import OfflineBanner from "@/components/OfflineBanner";

const PLATFORMS = ["Meet", "Teams", "Zoom", "Other"] as const;

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function RecordScreen() {
  const store = useRecordingStore();
  const { startRecording, pauseRecording, resumeRecording, stopRecording } = useRecording();

  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (store.status === "recording") {
      pulseScale.value = withRepeat(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1);
    }
  }, [store.status]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: store.status === "recording" ? 0.35 : 0,
  }));

  const isIdle = store.status === "idle";
  const isRecording = store.status === "recording";
  const isPaused = store.status === "paused";
  const isProcessing = store.status === "processing";
  const isDone = store.status === "done";
  const isActive = isRecording || isPaused;

  const micBgColor = isRecording ? "#DC2626" : isDone ? "#16A34A" : "#2563EB";

  return (
    <SafeAreaView className="flex-1 bg-[#0A0F1E]">
      <OfflineBanner />
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ alignItems: "center", paddingTop: 40 }}>
        <Text className="text-white text-2xl font-bold mb-2">
          {isIdle ? "Record Meeting" : isRecording ? "Recording..." : isPaused ? "Paused" : isProcessing ? "Processing..." : "Saved!"}
        </Text>
        <Text className="text-slate-400 text-sm mb-12">
          {isIdle ? "Tap the mic to start" : isRecording ? "Recording in progress" : isPaused ? "Tap resume to continue" : isProcessing ? "Analysing your meeting..." : "Meeting saved!"}
        </Text>

        {store.status === "recording" && (
          <View className="w-full mb-8">
            <AudioWaveform levels={store.meteringLevels} />
          </View>
        )}

        <View className="items-center justify-center mb-10" style={{ width: 180, height: 180 }}>
          <Animated.View
            style={[
              pulseStyle,
              {
                position: "absolute",
                width: 180,
                height: 180,
                borderRadius: 90,
                backgroundColor: "#DC2626",
              },
            ]}
          />
          <TouchableOpacity
            onPress={isIdle ? startRecording : isRecording ? pauseRecording : isPaused ? resumeRecording : undefined}
            disabled={isProcessing}
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: micBgColor,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: micBgColor,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5,
              shadowRadius: 16,
              elevation: 10,
            }}
            activeOpacity={0.85}
          >
            {isProcessing ? (
              <Ionicons name="hourglass-outline" size={44} color="#fff" />
            ) : isDone ? (
              <Ionicons name="checkmark" size={50} color="#fff" />
            ) : isRecording ? (
              <Ionicons name="pause" size={44} color="#fff" />
            ) : isPaused ? (
              <Ionicons name="play" size={44} color="#fff" />
            ) : (
              <Ionicons name="mic" size={48} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {isActive && (
          <Text className="text-blue-400 text-4xl font-bold tabular-nums mb-8">
            {formatTime(store.elapsedMs)}
          </Text>
        )}

        {isActive && (
          <>
            <TextInput
              value={store.title}
              onChangeText={store.setTitle}
              placeholder="Meeting title (optional)"
              placeholderTextColor="#4B5563"
              autoFocus
              className="w-full bg-[#1A2236] border border-[#1E293B] rounded-xl px-4 py-3 text-white text-base mb-4"
            />

            <View className="flex-row gap-2 mb-6 flex-wrap justify-center">
              {PLATFORMS.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => store.setPlatform(p.toLowerCase())}
                  className={`px-4 py-2 rounded-full border ${
                    store.platform === p.toLowerCase()
                      ? "bg-[#2563EB] border-[#2563EB]"
                      : "bg-transparent border-[#1E293B]"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      store.platform === p.toLowerCase() ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={stopRecording}
              className="w-full bg-[#1A2236] border border-[#DC2626] rounded-xl py-4 items-center mb-4"
              activeOpacity={0.8}
            >
              <Text className="text-red-400 font-semibold">Stop & Save</Text>
            </TouchableOpacity>
          </>
        )}

        {store.isOffline && (
          <View className="mt-4 flex-row items-center gap-2">
            <Ionicons name="cellular-outline" size={16} color="#F59E0B" />
            <Text className="text-amber-400 text-sm">Offline Mode — will sync when reconnected</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
