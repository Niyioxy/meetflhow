import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { getPendingRecordings, markAsSynced, clearSyncedRecordings } from "./offline";
import { api } from "./api";
import { uploadRecordingFile } from "./upload";
import { isOnline } from "./offline";

export async function syncOfflineRecordings(): Promise<{ synced: number; failed: number }> {
  if (!(await isOnline())) return { synced: 0, failed: 0 };

  const pending = await getPendingRecordings();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const recording of pending) {
    try {
      const exists = await FileSystem.getInfoAsync(recording.file_path);
      if (!exists.exists) {
        await markAsSynced(recording.id);
        continue;
      }

      const blob_url = await uploadRecordingFile(recording.file_path, recording.id);

      const result = await api.sync([
        {
          id: recording.id,
          title: recording.title,
          platform: recording.platform,
          recorded_at: recording.recorded_at,
          duration: recording.duration,
          blob_url,
        },
      ]);

      const resultItem = (result as { results?: Array<{ status: string }> }).results?.[0];
      if (resultItem?.status === "queued") {
        await markAsSynced(recording.id);
        await FileSystem.deleteAsync(recording.file_path, { idempotent: true });
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  await clearSyncedRecordings();

  if (synced > 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "MeetFlhow",
        body: `✅ ${synced} meeting${synced > 1 ? "s" : ""} synced and queued for analysis`,
      },
      trigger: null,
    });
  }

  return { synced, failed };
}
