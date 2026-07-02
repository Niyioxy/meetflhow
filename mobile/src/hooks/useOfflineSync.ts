import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { syncOfflineRecordings } from "@/lib/sync";
import { isOnline } from "@/lib/offline";

export function useOfflineSync() {
  const syncInProgress = useRef(false);

  const attemptSync = async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    try {
      await syncOfflineRecordings();
    } finally {
      syncInProgress.current = false;
    }
  };

  useEffect(() => {
    attemptSync();

    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active" && (await isOnline())) {
        attemptSync();
      }
    });

    const interval = setInterval(async () => {
      if (await isOnline()) attemptSync();
    }, 15 * 60 * 1000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);
}
