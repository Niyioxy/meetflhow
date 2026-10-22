import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { POST as uploadTokenRoute } from "@/app/api/mobile/upload-token/route";
import { signMobileToken } from "@/lib/mobile-auth";
import { createMobileUploadRequest, isValidLocalRecordingId } from "@/lib/mobile-upload";
import { isOwnMobileBlobUrl } from "@/lib/blob-urls";
import { resetDb } from "./helpers/test-db";
import { seedUser } from "./helpers/fixtures";

const RW_TOKEN = "vercel_blob_rw_teststore123_fakesecret";

let server: http.Server;
let received: { method?: string; url?: string; headers: http.IncomingHttpHeaders; bytes: number }[] = [];

beforeAll(async () => {
  process.env.BLOB_READ_WRITE_TOKEN = RW_TOKEN;
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ method: req.method, url: req.url, headers: req.headers, bytes: Buffer.concat(chunks).length });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ url: "https://teststore123.public.blob.vercel-storage.com/x.m4a", pathname: "x.m4a" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  process.env.VERCEL_BLOB_API_URL = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  delete process.env.VERCEL_BLOB_API_URL;
  await new Promise((resolve) => server.close(resolve));
});

describe("mobile upload request", () => {
  // The phone replays this request verbatim, so it has to be the request
  // @vercel/blob itself would send. If an SDK upgrade changes the protocol,
  // this fails instead of mobile uploads quietly breaking.
  it("matches the request the Blob SDK sends for a client-token upload", async () => {
    const { put } = await vi.importActual<typeof import("@vercel/blob")>("@vercel/blob");
    const pathname = "mobile-sync/user-1/rec-1.m4a";

    received = [];
    const token = await generateClientTokenFromReadWriteToken({ pathname, addRandomSuffix: true });
    await put(pathname, Buffer.from("abc"), {
      access: "public",
      contentType: "audio/m4a",
      addRandomSuffix: true,
      token,
    });
    const sdk = received[0];

    received = [];
    const ours = await createMobileUploadRequest("user-1", "rec-1");
    const res = await fetch(ours.url, { method: ours.method, headers: ours.headers, body: Buffer.from("abc") });
    const replay = received[0];

    expect(res.ok).toBe(true);
    expect(replay.method).toBe(sdk.method);
    expect(replay.url).toBe(sdk.url);
    for (const [name, value] of Object.entries(ours.headers)) {
      if (name === "authorization") {
        expect(value).toMatch(/^Bearer vercel_blob_client_teststore123_/);
        continue;
      }
      expect(sdk.headers[name], `SDK header ${name}`).toBe(value);
      expect(replay.headers[name], `replayed header ${name}`).toBe(value);
    }
  });

  it("scopes the token to the user's own upload path with a long enough window", async () => {
    const { headers } = await createMobileUploadRequest("user-1", "rec-1");
    const encoded = headers.authorization.replace(/^Bearer vercel_blob_client_teststore123_/, "");
    const decoded = Buffer.from(encoded, "base64").toString();
    const claims = JSON.parse(Buffer.from(decoded.slice(decoded.indexOf(".") + 1), "base64").toString());

    expect(claims.pathname).toBe("mobile-sync/user-1/rec-1.m4a");
    expect(claims.allowedContentTypes).toEqual(["audio/*"]);
    expect(claims.validUntil - Date.now()).toBeGreaterThan(30 * 60 * 1000);
  });

  it("rejects ids that could escape the user's path", async () => {
    for (const id of ["../x", "a/b", "", "a b", "x".repeat(101)]) {
      expect(isValidLocalRecordingId(id)).toBe(false);
      await expect(createMobileUploadRequest("user-1", id)).rejects.toThrow();
    }
    expect(isValidLocalRecordingId("1792636845803")).toBe(true);
  });
});

describe("isOwnMobileBlobUrl", () => {
  const ok = "https://s1.public.blob.vercel-storage.com/mobile-sync/u1/rec-abc.m4a";

  it("accepts only the owner's blob on Vercel's blob host", () => {
    expect(isOwnMobileBlobUrl("u1", ok)).toBe(true);
    expect(isOwnMobileBlobUrl("u2", ok)).toBe(false);
    expect(isOwnMobileBlobUrl("u1", ok.replace("https:", "http:"))).toBe(false);
    expect(isOwnMobileBlobUrl("u1", "https://evil.example.com/mobile-sync/u1/rec.m4a")).toBe(false);
    expect(isOwnMobileBlobUrl("u1", "https://s1.public.blob.vercel-storage.com.evil.com/mobile-sync/u1/r.m4a")).toBe(false);
    expect(isOwnMobileBlobUrl("u1", "https://s1.public.blob.vercel-storage.com/meeting-uploads/r.m4a")).toBe(false);
    expect(isOwnMobileBlobUrl("u1", "https://s1.public.blob.vercel-storage.com/mobile-sync/u1/../u2/r.m4a")).toBe(false);
    expect(isOwnMobileBlobUrl("u1", "https://s1.public.blob.vercel-storage.com/mobile-sync/u1/%2e%2e/u2/r.m4a")).toBe(false);
    expect(isOwnMobileBlobUrl("u1", "not a url")).toBe(false);
  });
});

describe("POST /api/mobile/upload-token", () => {
  const call = (token: string | null, body: unknown) =>
    uploadTokenRoute(
      new Request("https://app.test/api/mobile/upload-token", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      })
    );

  it("requires a mobile login and a valid id, then returns a request for that user", async () => {
    await resetDb();
    const user = await seedUser();
    const token = await signMobileToken(user.id);

    expect((await call(null, { id: "rec-1" })).status).toBe(401);
    expect((await call(token, { id: "../escape" })).status).toBe(400);
    expect((await call(token, {})).status).toBe(400);

    const res = await call(token, { id: "rec-1" });
    expect(res.status).toBe(200);
    const { upload } = await res.json();
    expect(upload.method).toBe("PUT");
    expect(decodeURIComponent(upload.url)).toContain(`mobile-sync/${user.id}/rec-1.m4a`);
  });
});
