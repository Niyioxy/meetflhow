import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
}

function scoreColor(score: number): [string, string] {
  if (score >= 80) return ["#16A34A", "#4ADE80"];
  if (score >= 60) return ["#1D4ED8", "#60A5FA"];
  if (score >= 40) return ["#92400E", "#F59E0B"];
  return ["#991B1B", "#F87171"];
}

export default function ScoreDial({ score, size = 180, strokeWidth = 14 }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useRef(new Animated.Value(0)).current;
  const [colorStart, colorEnd] = scoreColor(score);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: score / 100,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colorStart} />
            <Stop offset="1" stopColor={colorEnd} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1E293B"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#scoreGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
    </View>
  );
}
