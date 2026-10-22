import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { isOwnWebBlobUrl, webUploadPath, webUploadPrefix } from "@/lib/blob-urls";
import { resetDb } from "./helpers/test-db";
import { mocks, resetMocks } from "./helpers/mocks";
import { seedUser, testDb } from "./helpers/fixtures";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));

import { POST as uploadRoute } from "@/app/api/meetings/upload/route";
import { POST as uploadTokenRoute } from "@/app/api/meetings/upload-token/route";

beforeAll(() => {
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teststore123_fakesecret";
});

beforeEach(async () => {
  await resetDb();
  resetMocks();
  authMock.mockReset();
});

const blobUrl = (userId: string, name = "1-a.m4a-RANDOM") =>
  `https://store1.public.blob.vercel-storage.com/${webUploadPrefix(userId)}${name}`;

describe("webUploadPath", () => {
  it("scopes to the user and flattens anything unsafe in the name", () => {
    expect(webUploadPath("u1", "standup.webm", 5)).toBe("meeting-uploads/u1/5-standup.webm");
    expect(webUploadPath("u1", "../../etc/passwd", 5)).toBe("meeting-uploads/u1/5-._._etc_passwd");
    expect(webUploadPath("u1", "Q3 review (final)..webm", 5)).toBe("meeting-uploads/u1/5-Q3_review_final_.webm");
    expect(webUploadPath("u1", "", 5)).toBe("meeting-uploads/u1/5-recording");
    expect(webUploadPath("u1", "日本語.webm", 5)).toBe("meeting-uploads/u1/5-_.webm");
    expect(webUploadPath("u1", "x".repeat(300) + ".webm", 5).length).toBeLessThan(200);
  });

  it("always produces a path the token route accepts", () => {
    for (const name of ["a..b.webm", "..", "a/../b", "...", "my..title.webm"]) {
      const path = webUploadPath("u1", name);
      expect(path.startsWith(webUploadPrefix("u1"))).toBe(true);
      expect(path).not.toContain("..");
    }
  });
});

describe("isOwnWebBlobUrl", () => {
  it("accepts only the owner's blob under meeting-uploads on Vercel's blob host", () => {
    expect(isOwnWebBlobUrl("u1", blobUrl("u1"))).toBe(true);
    expect(isOwnWebBlobUrl("u2", blobUrl("u1"))).toBe(false);
    expect(isOwnWebBlobUrl("u1", `https://evil.example.com/${webUploadPrefix("u1")}x`)).toBe(false);
    expect(isOwnWebBlobUrl("u1", `https://store1.public.blob.vercel-storage.com/mobile-sync/u1/x.m4a`)).toBe(false);
    expect(isOwnWebBlobUrl("u1", `https://store1.public.blob.vercel-storage.com/meeting-uploads/u1/../u2/x`)).toBe(false);
  });
});

describe("POST /api/meetings/upload-token", () => {
  const call = (pathname: string) =>
    uploadTokenRoute(
      new Request("https://app.test/api/meetings/upload-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "blob.generate-client-token",
          payload: { pathname, clientPayload: null, multipart: true },
        }),
      })
    );

  it("rejects unauthenticated callers", async () => {
    authMock.mockResolvedValue(null);
    expect((await call("meeting-uploads/u1/1-a.webm")).status).toBe(401);
  });

  it("issues a token for the caller's own folder only", async () => {
    const user = await seedUser();
    authMock.mockResolvedValue({ user: { id: user.id } });

    const ok = await call(webUploadPath(user.id, "standup.webm"));
    expect(ok.status).toBe(200);
    expect((await ok.json()).clientToken).toMatch(/^vercel_blob_client_/);

    for (const pathname of [
      `meeting-uploads/${crypto.randomUUID()}/1-a.webm`, // someone else's folder
      "meeting-uploads/1-a.webm", // the old unscoped path
      `${webUploadPrefix(user.id)}../x.webm`,
      "mobile-sync/x/a.m4a",
    ]) {
      expect((await call(pathname)).status, pathname).toBe(400);
    }
  });
});

describe("POST /api/meetings/upload", () => {
  const call = (body: unknown) =>
    uploadRoute(
      new Request("https://app.test/api/meetings/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  it("processes a blob the caller uploaded", async () => {
    const user = await seedUser();
    authMock.mockResolvedValue({ user: { id: user.id } });
    const url = blobUrl(user.id);

    const res = await call({ blobUrl: url, title: "Standup" });

    expect(res.status).toBe(200);
    const db = await testDb();
    const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.userId, user.id));
    expect(meeting.blobUrl).toBe(url);
    expect(mocks.triggerInternalStep).toHaveBeenCalledWith(
      `/api/meetings/${meeting.id}/process-transcript`,
      expect.objectContaining({ blobUrl: url, userId: user.id })
    );
  });

  it("refuses another user's blob, other paths and other hosts", async () => {
    const user = await seedUser();
    const other = await seedUser();
    authMock.mockResolvedValue({ user: { id: user.id } });

    for (const url of [
      blobUrl(other.id),
      `https://store1.public.blob.vercel-storage.com/meeting-uploads/legacy-unscoped.webm`,
      `https://evil.example.com/${webUploadPrefix(user.id)}x.webm`,
    ]) {
      expect((await call({ blobUrl: url })).status, url).toBe(400);
    }

    const db = await testDb();
    expect(await db.select().from(schema.meetings).where(eq(schema.meetings.userId, user.id))).toHaveLength(0);
    expect(mocks.triggerInternalStep).not.toHaveBeenCalled();
  });
});
