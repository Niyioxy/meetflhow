import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useAuthStore } from "@/store/authStore";
import TabNavigator from "./TabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import type { RootStackParamList } from "@/types";

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isLoading, isAuthenticated, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={TabNavigator} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
