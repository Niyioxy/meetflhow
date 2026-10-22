import { beforeEach, describe, expect, it } from "vitest";
import { createOrUpdateShare, getPublicShare, verifySharePassword } from "@/lib/shares";
import { resetDb } from "./helpers/test-db";
import { resetMocks } from "./helpers/mocks";
import { seedMeeting, seedUser } from "./helpers/fixtures";

beforeEach(async () => {
  await resetDb();
  resetMocks();
});

async function seedProtectedShare(password: string) {
  const user = await seedUser();
  const meeting = await seedMeeting({ userId: user.id, status: "ready" });
  const share = await createOrUpdateShare(meeting.id, user.id, { password });
  return { user, meeting, share };
}

describe("password-protected shares", () => {
  it("unlocks with the cookie issued for the correct password", async () => {
    const { share } = await seedProtectedShare("first");

    expect(await verifySharePassword(share.token, "wrong")).toBeNull();
    const cookie = await verifySharePassword(share.token, "first");
    expect(cookie).toBeTruthy();

    expect((await getPublicShare(share.token, undefined))?.payload.locked).toBe(true);
    expect((await getPublicShare(share.token, "forged"))?.payload.locked).toBe(true);
    expect((await getPublicShare(share.token, cookie!))?.payload.locked).toBe(false);
  });

  it("revokes existing unlocks when the owner changes the password", async () => {
    const { user, meeting, share } = await seedProtectedShare("first");
    const oldCookie = await verifySharePassword(share.token, "first");

    await createOrUpdateShare(meeting.id, user.id, { password: "second" });

    const result = await getPublicShare(share.token, oldCookie!);
    expect(result?.payload.locked).toBe(true);
    expect(result?.payload.summary).toBeNull();
  });

  it("revokes existing unlocks even when the same password is set again", async () => {
    const { user, meeting, share } = await seedProtectedShare("first");
    const oldCookie = await verifySharePassword(share.token, "first");

    await createOrUpdateShare(meeting.id, user.id, { password: "first" });

    expect((await getPublicShare(share.token, oldCookie!))?.payload.locked).toBe(true);
  });
});
