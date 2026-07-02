import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { loginWithGoogleToken } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleClientId,
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
    androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId,
  });

  React.useEffect(() => {
    if (response?.type === "success" && response.authentication?.idToken) {
      handleGoogleLogin(response.authentication.idToken);
    } else if (response?.type === "success" && response.authentication?.accessToken) {
      handleGoogleLogin(response.authentication.accessToken);
    }
  }, [response]);

  async function handleGoogleLogin(token: string) {
    setLoading(true);
    try {
      const result = await loginWithGoogleToken(token);
      setUser(result.user);
    } catch (err) {
      Alert.alert("Sign in failed", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0F172A] items-center justify-center px-8">
      <View className="items-center mb-12">
        <View className="w-20 h-20 rounded-2xl bg-[#2563EB] items-center justify-center mb-6">
          <Text className="text-white text-4xl font-bold">M</Text>
        </View>
        <Text className="text-white text-3xl font-bold tracking-tight">MeetFlhow</Text>
        <Text className="text-slate-400 text-base mt-2">AI-powered meeting intelligence</Text>
      </View>

      <View className="w-full gap-4">
        <TouchableOpacity
          onPress={() => promptAsync()}
          disabled={!request || loading}
          className="w-full bg-[#2563EB] rounded-xl py-4 items-center flex-row justify-center gap-3"
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text className="text-white font-semibold text-base">Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text className="text-slate-600 text-xs mt-12 text-center">
        By signing in you agree to MeetFlhow's Terms of Service
      </Text>
    </SafeAreaView>
  );
}
