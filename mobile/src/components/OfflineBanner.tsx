import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Network from "expo-network";

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const state = await Network.getNetworkStateAsync();
      if (mounted) setOnline(state.isConnected === true && state.isInternetReachable !== false);
    };

    check();
    const interval = setInterval(check, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (online) return null;

  return (
    <View className="bg-amber-900/60 border-b border-amber-800/50 px-4 py-2 flex-row items-center gap-2">
      <Ionicons name="cellular-outline" size={14} color="#F59E0B" />
      <Text className="text-amber-300 text-xs flex-1">
        You're offline — recordings will sync when reconnected
      </Text>
    </View>
  );
}
