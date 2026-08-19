import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  Mic,
  FileAudio,
  Puzzle,
  Smartphone,
  Sparkles,
  ListChecks,
  Gauge,
  LineChart,
  Users2,
  Captions,
  Languages,
  CalendarClock,
  Building2,
  Lock,
  MessageSquare,
  Hash,
  BookOpen,
  Ticket,
  Webhook,
  DollarSign,
  Mail,
  RotateCcw,
  ShieldCheck,
  Check,
} from "lucide-react";

const FEATURE_GROUPS: {
  title: string;
  description: string;
  items: { icon: React.ElementType; title: string; description: string }[];
}[] = [
  {
    title: "Capture",
    description: "Get meetings into MeetFlhow however works for you.",
    items: [
      {
        icon: Mic,
        title: "Record in your browser",
        description: "One click to start recording your mic, with a live waveform and captions as you go.",
      },
      {
        icon: FileAudio,
        title: "Upload any file",
        description: "Drop in audio or video from Zoom, a phone recorder, or anywhere else — no size limit.",
      },
      {
        icon: Puzzle,
        title: "Chrome extension",
        description: "Record straight from a live Google Meet, Microsoft Teams, or Zoom tab.",
      },
      {
        icon: Smartphone,
        title: "Mobile app",
        description: "iOS and Android, with offline recording that syncs once you're back online.",
      },
    ],
  },
  {
    title: "Understand",
    description: "AI does the work of note-taking and follow-through.",
    items: [
      {
        icon: Sparkles,
        title: "Instant summaries",
        description: "Key decisions, open questions, and a clear summary — generated automatically.",
      },
      {
        icon: ListChecks,
        title: "Action items",
        description: "Owners and due dates extracted automatically, ready to turn into tasks.",
      },
      {
        icon: Gauge,
        title: "Meeting Coach",
        description: "A score on engagement, clarity, and balance — so meetings actually improve over time.",
      },
      {
        icon: LineChart,
        title: "Sentiment timeline",
        description: "See how the tone of a meeting shifted from start to finish, not just an average.",
      },
      {
        icon: Users2,
        title: "Speaker identification",
        description: "Enroll your voice once and MeetFlhow recognizes who said what, automatically.",
      },
      {
        icon: BookOpen,
        title: "Content-aware analysis",
        description: "Meetings, training sessions, sermons, and podcasts are each analyzed differently.",
      },
    ],
  },
  {
    title: "Live",
    description: "Follow along in real time, not just after the fact.",
    items: [
      {
        icon: Captions,
        title: "Live captions",
        description: "See what's being said as you record, no waiting for processing.",
      },
      {
        icon: Languages,
        title: "Live translation",
        description: "Real-time captions translated into Spanish, French, Hindi, or Chinese as you record.",
      },
    ],
  },
  {
    title: "Schedule",
    description: "Set up the meeting, not just record it.",
    items: [
      {
        icon: CalendarClock,
        title: "Real Google Meet & Teams links",
        description: "Schedule a meeting and get an auto-generated, working join link — synced to your calendar.",
      },
    ],
  },
  {
    title: "Collaborate",
    description: "Built for teams, not just individuals.",
    items: [
      {
        icon: Building2,
        title: "Workspaces & roles",
        description: "Owner, admin, member, and viewer roles keep the right people in control.",
      },
      {
        icon: Lock,
        title: "Secure sharing",
        description: "Share a meeting with a password-protected link — control exactly what's visible.",
      },
      {
        icon: MessageSquare,
        title: "Comments & mentions",
        description: "Discuss a specific moment in the transcript, and @mention teammates to loop them in.",
      },
    ],
  },
  {
    title: "Connect",
    description: "MeetFlhow fits into the tools you already use.",
    items: [
      {
        icon: Hash,
        title: "Slack",
        description: "Auto-post summaries and action items to the right channel the moment a meeting is ready.",
      },
      {
        icon: BookOpen,
        title: "Notion",
        description: "Push meeting notes straight into a Notion database, formatted and ready.",
      },
      {
        icon: Ticket,
        title: "Jira & Linear",
        description: "Turn any action item into a ticket in one click, in the tracker your team already uses.",
      },
      {
        icon: Webhook,
        title: "Webhooks & Zapier",
        description: "Send meeting events anywhere else with a webhook, or plug into thousands of apps via Zapier.",
      },
    ],
  },
  {
    title: "Costs & follow-ups",
    description: "See the real cost of a meeting, and close the loop after it.",
    items: [
      {
        icon: DollarSign,
        title: "Meeting cost calculator",
        description: "Based on attendee salaries, see exactly what a meeting cost the business.",
      },
      {
        icon: Mail,
        title: "AI follow-up emails",
        description: "One click drafts a follow-up email summarizing decisions and next steps.",
      },
    ],
  },
];

const FAQS = [
  {
    q: "Do you store my meeting audio?",
    a: "No. Raw audio is deleted the moment transcription completes — MeetFlhow never retains recordings. Only the transcript and AI analysis are kept.",
  },
  {
    q: "What if processing fails partway through?",
    a: "Your recording isn't lost. If transcription or analysis fails, you can retry it directly from the meeting page — no need to re-record.",
  },
  {
    q: "Does it work with Zoom?",
    a: "Yes — record via the Chrome extension while on a Zoom call, or upload a Zoom recording file directly.",
  },
  {
    q: "What languages are supported?",
    a: "The app interface and live translation both support English, Spanish, French, Hindi, and Chinese.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes — every workspace starts on the Free plan with 5 recordings a month and full access to every feature.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to try MeetFlhow properly.",
    features: [
      "5 recordings per month, per workspace",
      "AI summaries, decisions & action items",
      "Live captions & translation",
      "Google Meet & Microsoft Teams scheduling",
      "Slack, Notion, Jira & Linear integrations",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Team",
    price: "$15",
    period: "/ month per workspace",
    description: "For teams that don't want to think about limits.",
    features: [
      "Unlimited recordings",
      "Everything in Free",
      "Priority processing",
      "Team roles & permissions",
      "Priority support",
    ],
    cta: "Upgrade anytime",
    highlighted: true,
  },
];

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 ${className ?? ""}`}>
      {children}
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      <Section className="flex flex-col items-center pb-16 pt-20 text-center sm:pt-28">
        <Badge variant="secondary" className="mb-6 gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          AI meeting intelligence
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Meetings that write their own summary.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
          Record, transcribe, and analyze every meeting automatically — decisions, action items,
          and sentiment, ready before you&apos;ve even left the call.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/login">Get started free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · 5 free recordings every month
        </p>
      </Section>

      {/* How it works */}
      <Section id="how-it-works" className="border-t border-border">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground">Three steps, fully automatic after you hit stop.</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Record",
              description:
                "Record in your browser, upload a file, or connect Google Meet or Microsoft Teams.",
              icon: Mic,
            },
            {
              step: "2",
              title: "Transcribe",
              description:
                "Industry-grade speech-to-text with automatic speaker identification via voice matching.",
              icon: Captions,
            },
            {
              step: "3",
              title: "Analyze",
              description:
                "AI extracts summaries, decisions, action items, sentiment, and a meeting coach score.",
              icon: Sparkles,
            },
          ].map(({ step, title, description, icon: Icon }) => (
            <Card key={step} className="relative overflow-hidden">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(37,99,235,0.15)] text-[var(--blue-light)]">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>
                  <span className="mr-2 text-muted-foreground">{step}.</span>
                  {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Section>

      {/* Features */}
      <Section id="features" className="border-t border-border">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a meeting could need
          </h2>
          <p className="mt-3 text-muted-foreground">
            From capture to follow-up, MeetFlhow handles the whole lifecycle.
          </p>
        </div>
        <div className="flex flex-col gap-16">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-6">
                <h3 className="text-xl font-semibold tracking-tight">{group.title}</h3>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(({ icon: Icon, title, description }) => (
                  <Card key={title} className="h-full">
                    <CardHeader>
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-card-hover)] text-[var(--blue-light)]">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <CardTitle className="text-base">{title}</CardTitle>
                      <CardDescription>{description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Retry / reliability callout */}
      <Section className="border-t border-border">
        <Card className="border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.06)]">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center sm:flex-row sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(37,99,235,0.15)] text-[var(--blue-light)]">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Your recording is never lost</h3>
              <p className="text-sm text-muted-foreground">
                If transcription or analysis ever fails, retry it with one click — no re-recording,
                nothing to redo.
              </p>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Pricing */}
      <Section id="pricing" className="border-t border-border">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple, per-workspace pricing</h2>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade only when you need unlimited recordings.</p>
        </div>
        <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlighted ? "border-[var(--blue-primary)] shadow-[var(--shadow-glow)]" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.highlighted && <Badge>Most popular</Badge>}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--green)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-2 w-full" variant={plan.highlighted ? "default" : "outline"} asChild>
                  <Link href="/login">{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="border-t border-border">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h2>
        </div>
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {FAQS.map(({ q, a }) => (
            <Card key={q}>
              <CardHeader>
                <CardTitle className="text-base">{q}</CardTitle>
                <CardDescription>{a}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="border-t border-border">
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center gap-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(37,99,235,0.15)] text-[var(--blue-light)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Start recording smarter meetings today
            </h2>
            <p className="max-w-md text-muted-foreground">
              Free to start, no credit card required. Your first recording is minutes away.
            </p>
            <Button size="lg" asChild>
              <Link href="/login">Get started free</Link>
            </Button>
          </CardContent>
        </Card>
      </Section>

      <SiteFooter />
    </div>
  );
}
