/**
 * Manual evaluation harness for Sermon Coach — run on a handful of real
 * sermons before enabling it for users, and after any prompt change.
 *
 *   npx tsx scripts/eval-sermon-coach.ts <dir> [--tradition "Reformed Baptist"]
 *
 * <dir> holds one file per sermon: `.txt` (a pasted transcript, no
 * timestamps) or `.json` ({ "fullText": string, "utterances"?: [...] } —
 * the shape of a transcripts row). Reads local files only; never touches
 * the database. Makes real Gemini calls (GEMINI_API_KEY from .env.local).
 *
 * Reports what a reviewer needs to judge it: scores, how much of the
 * model's output survived evidence grounding (a high omission rate means
 * the model is paraphrasing instead of quoting), and every kept claim.
 */
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const args = process.argv.slice(2);
  const dir = args[0];
  const traditionFlag = args.indexOf("--tradition");
  const tradition = traditionFlag >= 0 ? args[traditionFlag + 1] : null;
  if (!dir) {
    console.error('Usage: npx tsx scripts/eval-sermon-coach.ts <dir> [--tradition "…"]');
    process.exit(1);
  }

  // Imported after dotenv so the Gemini client sees the key.
  const { generateSermonCoach } = await import("../lib/gemini/sermon-coach");
  const { SERMON_COACH_RUBRIC } = await import("../lib/sermon-coach/rubric");
  const { sermonCoachDimensionKeys } = await import("../types/analysis");

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt") || f.endsWith(".json"));
  let totalKept = 0;
  let totalOmitted = 0;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const input = file.endsWith(".json")
      ? (JSON.parse(raw) as { fullText: string; utterances?: never[] })
      : { fullText: raw };

    const started = Date.now();
    try {
      const coach = await generateSermonCoach({
        transcriptText: input.fullText,
        utterances: input.utterances ?? null,
        tradition,
      });
      const kept =
        coach.strengths.length +
        coach.improvements.length +
        coach.unclearOrRepetitive.length +
        coach.suggestedCuts.length +
        coach.claimsToVerify.length +
        coach.traditionNotes.length +
        (coach.strongestMoment ? 1 : 0) +
        (coach.nextSermonFocus ? 1 : 0) +
        sermonCoachDimensionKeys.reduce((n, k) => n + coach.dimensions[k].evidence.length, 0);
      totalKept += kept;
      totalOmitted += coach.omittedForMissingEvidence;

      console.log(`\n=== ${file} (${((Date.now() - started) / 1000).toFixed(1)}s) ===`);
      console.log(`Overall ${coach.overallScore ?? "n/a"} | timestamps: ${coach.timestampsAvailable}`);
      for (const key of sermonCoachDimensionKeys) {
        const d = coach.dimensions[key];
        const score = d.insufficientEvidence ? "n/a (insufficient evidence)" : String(d.score).padStart(3);
        console.log(`  ${SERMON_COACH_RUBRIC[key].label.padEnd(28)} ${score}  (${d.evidence.length} quotes)`);
      }
      console.log(`Evidence: ${kept} kept, ${coach.omittedForMissingEvidence} omitted`);
      console.log(`Strongest moment: ${coach.strongestMoment?.point ?? "(omitted)"}`);
      console.log(`Next focus: ${coach.nextSermonFocus?.point ?? "(omitted)"}`);
      for (const claim of coach.claimsToVerify) {
        console.log(`  Claim [${claim.passage}] ${claim.claim}\n    → ${claim.reason}`);
      }
    } catch (error) {
      console.error(`\n=== ${file}: FAILED ===`, error);
    }
  }

  const total = totalKept + totalOmitted;
  console.log(
    `\nAcross ${files.length} sermons: ${totalOmitted}/${total} observations omitted for missing evidence` +
      (total ? ` (${Math.round((totalOmitted / total) * 100)}%)` : "")
  );
}

main();
