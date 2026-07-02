import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

interface Props {
  levels: number[];
  barCount?: number;
  height?: number;
  color?: string;
}

const BAR_MIN = 4;
const BAR_MAX_FRACTION = 0.9;

function AnimatedBar({ level, maxHeight, color }: { level: number; maxHeight: number; color: string }) {
  const barHeight = Math.max(BAR_MIN, level * maxHeight * BAR_MAX_FRACTION);

  const style = useAnimatedStyle(() => ({
    height: withSpring(barHeight, { damping: 10, stiffness: 120 }),
    backgroundColor: color,
    borderRadius: 2,
    width: 3,
    alignSelf: "center" as const,
  }));

  return <Animated.View style={style} />;
}

export default function AudioWaveform({ levels, barCount = 40, height = 60, color = "#2563EB" }: Props) {
  const padded = Array.from({ length: barCount }, (_, i) => levels[levels.length - barCount + i] ?? 0);

  return (
    <View style={{ height, flexDirection: "row", alignItems: "center", gap: 2, justifyContent: "center" }}>
      {padded.map((level, i) => (
        <AnimatedBar key={i} level={level} maxHeight={height} color={color} />
      ))}
    </View>
  );
}
