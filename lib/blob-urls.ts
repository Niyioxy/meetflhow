// Uploads go straight from the client to Vercel Blob, and the processing
// pipeline later fetches — then deletes — whatever blob URL a meeting points
// at. So a URL handed back to us must be proven to be one this user was
// allowed to upload, or it could aim the pipeline at someone else's blob (or
// at a different host entirely).

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/** True only for an https Vercel Blob URL whose path sits under `prefix`. */
export function isBlobUrlUnder(blobUrl: string, prefix: string): boolean {
  let url: URL;
  try {
    url = new URL(blobUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(BLOB_HOST_SUFFIX)) return false;
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return false;
  }
  return path.startsWith(`/${prefix}`) && !path.includes("..");
}

/** Browser uploads (record + upload pages), scoped per user. */
export function webUploadPrefix(userId: string): string {
  return `meeting-uploads/${userId}/`;
}

/**
 * The blob path a browser upload should use. File names and recording titles
 * are user text, so anything outside a safe set is flattened (no `/`, no `..`)
 * before it can trip the upload-token path check or Blob's own path rules.
 */
export function webUploadPath(userId: string, fileName: string, now = Date.now()): string {
  const safe = fileName
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(-120);
  return `${webUploadPrefix(userId)}${now}-${safe || "recording"}`;
}

export function isOwnWebBlobUrl(userId: string, blobUrl: string): boolean {
  return isBlobUrlUnder(blobUrl, webUploadPrefix(userId));
}

/** Mobile app uploads, scoped per user. */
export function mobileUploadPrefix(userId: string): string {
  return `mobile-sync/${userId}/`;
}

export function isOwnMobileBlobUrl(userId: string, blobUrl: string): boolean {
  return isBlobUrlUnder(blobUrl, mobileUploadPrefix(userId));
}
