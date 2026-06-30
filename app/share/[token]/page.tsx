import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { format } from "date-fns";
import { Logo } from "@/components/ui/logo";
import { PasswordGate } from "@/components/share/password-gate";
import { TranscriptSearch } from "@/components/share/transcript-search";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import { getPublicShare, unlockCookieName, unlockCookieValue } from "@/lib/shares";

export default async function PublicSharePage({ params }: { params: { token: string } }) {
  const cookieStore = cookies();
  const unlocked =
    cookieStore.get(unlockCookieName(params.token))?.value === unlockCookieValue(params.token);

  const result = await getPublicShare(params.token, unlocked);
  if (!result) {
    notFound();
  }

  const { payload, expired } = result;

  if (expired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <Logo size="sm" />
        <h1 className="text-lg font-semibold text-slate-900">This share link has expired</h1>
        <p className="text-sm text-slate-500">Ask the meeting owner for a new link.</p>
      </div>
    );
  }

  if (payload.locked) {
    return <PasswordGate token={params.token} />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-100 px-6 py-4">
        <Link href="/">
          <Logo size="sm" />
        </Link>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{payload.meeting_title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{format(new Date(payload.meeting_date), "MMM d, yyyy · h:mm a")}</span>
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs capitalize">
              {payload.platform}
            </span>
            {payload.duration_seconds ? (
              <span>{Math.round(payload.duration_seconds / 60)} min</span>
            ) : null}
          </div>
          {payload.shared_by_name && (
            <div className="mt-1 flex items-center gap-2">
              {payload.shared_by_image ? (
                <img src={payload.shared_by_image} alt="" className="size-6 rounded-full" />
              ) : (
                <div
                  className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: colorFromName(payload.shared_by_name) }}
                >
                  {initialsFromName(payload.shared_by_name)}
                </div>
              )}
              <span className="text-sm text-slate-500">Shared by {payload.shared_by_name}</span>
            </div>
          )}
        </div>

        {payload.summary && (
          <section className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{payload.summary}</p>
            {payload.decisions.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">Key decisions</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {payload.decisions.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {payload.show_action_items && payload.action_items && (
          <section className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Action items</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {payload.action_items.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-4 shrink-0 rounded border border-slate-300" />
                    <span className="text-slate-800">{item.task}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                    {item.owner && <span>{item.owner}</span>}
                    {item.due_date && <span>{item.due_date}</span>}
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 capitalize">
                      {item.priority}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {payload.show_score && payload.score && (
          <section className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Meeting score</h2>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#2563EB]">{payload.score.overall_score}</span>
              <span className="text-sm text-slate-500">/ 100</span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{payload.score.feedback}</p>
          </section>
        )}

        {payload.show_transcript && (
          <section className="rounded-xl border border-slate-200 p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Transcript</h2>
            <TranscriptSearch
              fullText={payload.transcript_full_text}
              segments={payload.transcript_segments}
            />
          </section>
        )}
      </main>

      <footer className="flex flex-col items-center gap-3 border-t border-slate-100 px-6 py-8 text-center">
        <p className="text-xs text-slate-400">
          Powered by{" "}
          <Link href="/" className="font-medium text-slate-500 hover:text-slate-700">
            MeetFlhow
          </Link>
        </p>
        <Link
          href="/login"
          className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]"
        >
          Create your free account
        </Link>
      </footer>
    </div>
  );
}
