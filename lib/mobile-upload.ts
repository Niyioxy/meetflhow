import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { mobileUploadPrefix } from "@/lib/blob-urls";

// Mobile recordings are uploaded straight from the phone to Vercel Blob so the
// audio never passes through a serverless function (Vercel caps request bodies
// at 4.5 MB, which a few minutes of audio exceeds). The phone is handed a
// ready-made request, so it knows nothing about Blob's wire protocol.

// Matches the request @vercel/blob itself sends for a client-token put().
// tests/mobile-upload.test.ts replays the SDK's real request and fails if an
// SDK upgrade changes any of these.
const BLOB_API_VERSION = "12";
const DEFAULT_BLOB_API_URL = "https://vercel.com/api/blob";

export const MAX_MOBILE_UPLOAD_BYTES = 500 * 1024 * 1024;
// Long enough for a large recording on a slow mobile connection (the SDK's
// default of 30s is not).
const UPLOAD_TOKEN_TTL_MS = 60 * 60 * 1000;

const LOCAL_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export function isValidLocalRecordingId(id: string): boolean {
  return LOCAL_ID_RE.test(id);
}

export interface MobileUploadRequest {
  method: "PUT";
  url: string;
  headers: Record<string, string>;
}

export async function createMobileUploadRequest(userId: string, localId: string): Promise<MobileUploadRequest> {
  if (!isValidLocalRecordingId(localId)) throw new Error("Invalid recording id");

  const pathname = `${mobileUploadPrefix(userId)}${localId}.m4a`;
  const token = await generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: ["audio/*"],
    maximumSizeInBytes: MAX_MOBILE_UPLOAD_BYTES,
    validUntil: Date.now() + UPLOAD_TOKEN_TTL_MS,
    // Unguessable URL: this is meeting audio on a public blob.
    addRandomSuffix: true,
  });

  // vercel_blob_client_<storeId>_<signed payload>
  const storeId = token.split("_")[3];
  const baseUrl = process.env.VERCEL_BLOB_API_URL || DEFAULT_BLOB_API_URL;

  return {
    method: "PUT",
    url: `${baseUrl}/?pathname=${encodeURIComponent(pathname)}`,
    headers: {
      authorization: `Bearer ${token}`,
      "x-api-version": BLOB_API_VERSION,
      "x-vercel-blob-store-id": storeId,
      "x-vercel-blob-access": "public",
      "x-content-type": "audio/m4a",
      "x-add-random-suffix": "1",
    },
  };
}

