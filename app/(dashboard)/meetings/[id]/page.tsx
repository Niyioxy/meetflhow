import { notFound } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { getMeetingDetail } from "@/lib/meetings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import { SentimentBadge } from "@/components/meeting/sentiment-badge";
import { ActionItemsCard } from "@/components/meeting/action-items-card";
import { ProcessingBanner } from "@/components/meeting/processing-banner";
import { MeetingCoachCard } from "@/components/meeting/meeting-coach-card";
import { SentimentTimelineCard } from "@/components/meeting/sentiment-timeline-card";
import { TranscriptCard } from "@/components/meeting/transcript-card";
import { FollowUpEmailButton } from "@/components/meeting/follow-up-email-button";
import { MeetingCostCard } from "@/components/meeting/meeting-cost-card";

export default async function MeetingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const meeting = await getMeetingDetail(params.id, session!.user.id);

  if (!meeting) {
    notFound();
  }

  const isProcessing = !["ready", "failed"].includes(meeting.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{format(new Date(meeting.createdAt), "MMM d, yyyy · h:mm a")}</span>
            <PlatformBadge platform={meeting.platform} />
            {meeting.durationSeconds ? (
              <span>{Math.round(meeting.durationSeconds / 60)} min</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={meeting.status} />
          {meeting.analysis && <SentimentBadge sentiment={meeting.analysis.sentiment} />}
          {meeting.status === "ready" && <FollowUpEmailButton meetingId={meeting.id} />}
        </div>
      </div>

      {isProcessing && <ProcessingBanner meetingId={meeting.id} status={meeting.status} />}

      {meeting.status === "failed" && (
        <Card className="border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]">
          <CardContent className="py-6 text-[#F87171]">
            Something went wrong while processing this meeting. Try uploading it again.
          </CardContent>
        </Card>
      )}

      {meeting.analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{meeting.analysis.summary}</p>
          </CardContent>
        </Card>
      )}

      {meeting.analysis && (meeting.analysis.decisions.length > 0 || meeting.analysis.openQuestions.length > 0) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {meeting.analysis.decisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key decisions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {meeting.analysis.decisions.map((decision, i) => (
                    <li key={i}>{decision}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {meeting.analysis.openQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Open questions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {meeting.analysis.openQuestions.map((question, i) => (
                    <li key={i}>{question}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {meeting.status === "ready" && (
        <ActionItemsCard
          meetingTitle={meeting.title}
          initialItems={meeting.actionItems.map((item) => ({
            id: item.id,
            task: item.task,
            owner: item.owner,
            deadline: item.deadline,
            priority: item.priority,
            status: item.status,
          }))}
        />
      )}

      {meeting.status === "ready" && (
        <MeetingCostCard
          meetingId={meeting.id}
          durationSeconds={meeting.durationSeconds}
          initialAttendees={meeting.attendeeSalaries ?? null}
          initialCost={meeting.calculatedCost ?? null}
          suggestedNames={Array.from(
            new Set(
              (meeting.transcript?.speakerSegments ?? [])
                .map((s) => s.speaker)
                .filter((name) => name && name !== "Unknown")
            )
          )}
        />
      )}

      {meeting.status === "ready" && meeting.transcript && (
        <MeetingCoachCard
          meetingId={meeting.id}
          initialScore={meeting.analysis?.meetingScore ?? null}
        />
      )}

      {meeting.status === "ready" && meeting.transcript && (
        <SentimentTimelineCard
          meetingId={meeting.id}
          initialTimeline={meeting.analysis?.sentimentTimeline ?? null}
        />
      )}

      {meeting.transcript && (
        <TranscriptCard
          meetingId={meeting.id}
          fullText={meeting.transcript.fullText}
          wordCount={meeting.transcript.wordCount}
          language={meeting.transcript.language}
          initialSegments={meeting.transcript.speakerSegments ?? null}
        />
      )}
    </div>
  );
}
