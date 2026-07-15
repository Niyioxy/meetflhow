import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "@/screens/HomeScreen";
import MeetingsScreen from "@/screens/MeetingsScreen";
import MeetingDetailScreen from "@/screens/MeetingDetailScreen";
import RecordScreen from "@/screens/RecordScreen";
import TasksScreen from "@/screens/TasksScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import type { TabParamList, HomeStackParamList, MeetingsStackParamList } from "@/types";

const Tab = createBottomTabNavigator<TabParamList>();

const HomeStack = createStackNavigator<HomeStackParamList>();
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeScreen" component={HomeScreen} />
      <HomeStack.Screen name="MeetingDetail" component={MeetingDetailScreen} />
    </HomeStack.Navigator>
  );
}

const MeetingsStack = createStackNavigator<MeetingsStackParamList>();
function MeetingsStackNavigator() {
  return (
    <MeetingsStack.Navigator screenOptions={{ headerShown: false }}>
      <MeetingsStack.Screen name="MeetingsList" component={MeetingsScreen} />
      <MeetingsStack.Screen name="MeetingDetail" component={MeetingDetailScreen} />
    </MeetingsStack.Navigator>
  );
}

type RecordTabButtonProps = {
  onPress?: () => void;
};

function RecordTabButton({ onPress }: RecordTabButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.recordButton}
      activeOpacity={0.85}
    >
      <View style={styles.recordButtonInner}>
        <Ionicons name="mic" size={26} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  recordButton: {
    top: -18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  recordButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#111827",
          borderTopColor: "#1E293B",
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#4B5563",
        tabBarLabelStyle: { fontSize: 11, marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Meetings"
        component={MeetingsStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Record"
        component={RecordScreen}
        options={{
          tabBarLabel: "",
          tabBarButton: (props) => <RecordTabButton onPress={props.onPress ? () => props.onPress!({} as any) : undefined} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
