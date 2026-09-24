import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createTestDb, MIGRATIONS_FOLDER } from "./helpers/test-db";

/** A copy of the migrations folder that stops just before `tag`. */
function migrationsBefore(tag: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meetflhow-migrations-"));
  fs.cpSync(MIGRATIONS_FOLDER, dir, { recursive: true });
  const journalPath = path.join(dir, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const index = journal.entries.findIndex((e: { tag: string }) => e.tag === tag);
  journal.entries = journal.entries.slice(0, index);
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

const USER = "00000000-0000-0000-0000-000000000001";
const READY_MEETING = "00000000-0000-0000-0000-0000000000a1";
const CRASHED_MEETING = "00000000-0000-0000-0000-0000000000a2";

const SEED_OLD_PIPELINE_DUPLICATES = `
  insert into users (id, email) values ('${USER}', 'o@example.com');
  insert into meetings (id, user_id, title, status) values
    ('${READY_MEETING}', '${USER}', 'Ready', 'ready'),
    ('${CRASHED_MEETING}', '${USER}', 'Crashed', 'failed');

  -- Two transcripts for one meeting: the older has the search chunks (one
  -- of them duplicated); the newer has speaker segments, so it's kept.
  insert into transcripts (id, meeting_id, full_text, speaker_segments, created_at) values
    ('00000000-0000-0000-0000-0000000000b1', '${READY_MEETING}', 'take one', null, now() - interval '2 minutes'),
    ('00000000-0000-0000-0000-0000000000b2', '${READY_MEETING}', 'take two', '[]', now() - interval '1 minute');
  insert into transcript_chunks (meeting_id, transcript_id, chunk_index, content, created_at) values
    ('${READY_MEETING}', '00000000-0000-0000-0000-0000000000b1', 0, 'c0', now() - interval '3 minutes'),
    ('${READY_MEETING}', '00000000-0000-0000-0000-0000000000b1', 0, 'c0 again', now() - interval '2 minutes'),
    ('${READY_MEETING}', '00000000-0000-0000-0000-0000000000b1', 1, 'c1', now() - interval '1 minute');

  -- Two analysis rows: the summary lives on one, the coach score on the other.
  insert into analysis (id, meeting_id, summary, meeting_score, created_at) values
    ('00000000-0000-0000-0000-0000000000c1', '${READY_MEETING}', 'The summary', null, now() - interval '2 minutes'),
    ('00000000-0000-0000-0000-0000000000c2', '${READY_MEETING}', '', '{"overall_score": 70}', now() - interval '1 minute'),
    ('00000000-0000-0000-0000-0000000000c3', '${CRASHED_MEETING}', 'Partial', null, now());

  -- Two action items with identical text, a third, and their tasks — plus
  -- a task whose title the user edited.
  insert into action_items (id, meeting_id, task, created_at) values
    ('00000000-0000-0000-0000-0000000000d1', '${READY_MEETING}', 'Send deck', now() - interval '3 minutes'),
    ('00000000-0000-0000-0000-0000000000d2', '${READY_MEETING}', 'Send deck', now() - interval '2 minutes'),
    ('00000000-0000-0000-0000-0000000000d3', '${READY_MEETING}', 'Book room', now() - interval '1 minute');
  insert into tasks (id, user_id, meeting_id, title, created_at) values
    ('00000000-0000-0000-0000-0000000000e1', '${USER}', '${READY_MEETING}', 'Send deck', now() - interval '3 minutes'),
    ('00000000-0000-0000-0000-0000000000e2', '${USER}', '${READY_MEETING}', 'Send deck', now() - interval '2 minutes'),
    ('00000000-0000-0000-0000-0000000000e3', '${USER}', '${READY_MEETING}', 'Book room', now() - interval '1 minute'),
    ('00000000-0000-0000-0000-0000000000e4', '${USER}', '${READY_MEETING}', 'Renamed by user', now());
`;

describe("0021_idempotent_processing migration", () => {
  it("reconciles duplicates left by the old pipeline, then enforces uniqueness", async () => {
    const { client, db } = await createTestDb(migrationsBefore("0021_idempotent_processing"));
    await client.exec(SEED_OLD_PIPELINE_DUPLICATES);

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const q = async <T>(text: string) => (await client.query<T>(text)).rows;

    expect(await q(`select id from transcripts`)).toEqual([{ id: "00000000-0000-0000-0000-0000000000b2" }]);
    expect(
      await q(`select transcript_id, chunk_index, content from transcript_chunks order by chunk_index`)
    ).toEqual([
      { transcript_id: "00000000-0000-0000-0000-0000000000b2", chunk_index: 0, content: "c0" },
      { transcript_id: "00000000-0000-0000-0000-0000000000b2", chunk_index: 1, content: "c1" },
    ]);

    const analysis = await q<{
      id: string;
      summary: string;
      meeting_score: unknown;
      core_completed_at: Date | null;
    }>(`select id, summary, meeting_score, core_completed_at from analysis order by id`);
    expect(analysis).toHaveLength(2);
    expect(analysis[0]).toMatchObject({ id: "00000000-0000-0000-0000-0000000000c1", summary: "The summary" });
    expect(analysis[0].meeting_score).toEqual({ overall_score: 70 });
    expect(analysis[0].core_completed_at).not.toBeNull(); // its meeting reached "ready"
    expect(analysis[1].core_completed_at).toBeNull(); // crashed: a retry must finish it

    expect(await q(`select id, action_item_id from tasks order by id`)).toEqual([
      { id: "00000000-0000-0000-0000-0000000000e1", action_item_id: "00000000-0000-0000-0000-0000000000d1" },
      { id: "00000000-0000-0000-0000-0000000000e2", action_item_id: "00000000-0000-0000-0000-0000000000d2" },
      { id: "00000000-0000-0000-0000-0000000000e3", action_item_id: "00000000-0000-0000-0000-0000000000d3" },
      { id: "00000000-0000-0000-0000-0000000000e4", action_item_id: null },
    ]);

    await expect(
      client.exec(`insert into transcripts (meeting_id, full_text) values ('${READY_MEETING}', 'dup')`)
    ).rejects.toThrow(/transcripts_meeting_id_unique/);
    await expect(
      client.exec(`insert into analysis (meeting_id, summary) values ('${READY_MEETING}', '')`)
    ).rejects.toThrow(/analysis_meeting_id_unique/);
  });
});
