import * as FileSystem from "expo-file-system/legacy";
import { api } from "./api";

/**
 * Streams a recording from disk straight to blob storage and returns its URL,
 * which the sync call then hands to the server. The audio never goes through
 * the API (its request-size limit is a few minutes of audio) and is never
 * read into JS memory as base64.
 */
export async function uploadRecordingFile(filePath: string, localId: string): Promise<string> {
  const { upload } = await api.uploadRequest(localId);

  const res = await FileSystem.uploadAsync(upload.url, filePath, {
    httpMethod: upload.method,
    headers: upload.headers,
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Upload failed: ${res.status}`);
  }

  const url = (JSON.parse(res.body) as { url?: string }).url;
  if (!url) throw new Error("Upload response had no URL");
  return url;
}
