// Content for the public solution and integration pages. Every claim here
// must match what the product really does — each one was checked against the
// code that produces it (lib/gemini/vertical-content.ts, lib/sermon-coach,
// lib/deal-radar.ts, lib/integrations/*). When a feature changes, change the
// page with it; when a limit exists, say so on the page.

export type MarketingSection = "solutions" | "features";

export interface MarketingPage {
  section: MarketingSection;
  slug: string;
  /** <title>; keep under ~60 characters. */
  metaTitle: string;
  /** Meta description; keep under ~160 characters. */
  metaDescription: string;
  /** Short label used in breadcrumbs and cross-links. */
  navLabel: string;
  eyebrow: string;
  h1: string;
  lede: string;
  outputsHeading: string;
  outputs: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  /** Honest limits worth stating up front. */
  goodToKnow: string[];
  faq: { q: string; a: string }[];
  related: { section: MarketingSection; slug: string }[];
}

const COMMON_CAPTURE_STEP = {
  title: "Record or upload",
  body: "Record in your browser, or upload an audio or video file you already have.",
};

export const MARKETING_PAGES: MarketingPage[] = [
  {
    section: "solutions",
    slug: "churches",
    metaTitle: "AI Sermon Notes & Discussion Guides — MeetFlhow",
    metaDescription:
      "Turn a recorded sermon into a transcript, a central theme, scripture references and small-group discussion questions, plus private preaching feedback.",
    navLabel: "Churches",
    eyebrow: "For churches",
    h1: "Turn every sermon into a small-group discussion guide",
    lede: "Record or upload a sermon and MeetFlhow writes the guide from what was actually said: the central theme, the scripture cited, and questions that move a group from understanding to application.",
    outputsHeading: "What you get from each sermon",
    outputs: [
      {
        title: "Central theme",
        body: "One sentence capturing the sermon's central message, taken from the transcript.",
      },
      {
        title: "Scripture references",
        body: "Only passages the preacher actually cited or clearly quoted. If none were cited, the list is empty — the guide is told never to add references that weren't said.",
      },
      {
        title: "Discussion questions",
        body: "Five to seven open-ended questions, moving from understanding the message to applying it personally.",
      },
      {
        title: "Transcript and share link",
        body: "A full transcript with speaker labels, and a share link you can send to your group — optionally password-protected.",
      },
      {
        title: "Private preaching feedback (Sermon Coach)",
        body: "Optional feedback on how well the sermon communicated: big-idea clarity, scripture grounding, structure and flow, and application. Every observation is tied to a real quote and timestamp.",
      },
    ],
    steps: [
      COMMON_CAPTURE_STEP,
      {
        title: "Choose the sermon content type",
        body: "MeetFlhow shapes the output to what you recorded, so a sermon gets a discussion guide instead of a business-meeting summary.",
      },
      {
        title: "Read, share or reuse the guide",
        body: "Review the guide on the sermon's page, then share it with a link or copy it into your own material.",
      },
    ],
    goodToKnow: [
      "Sermon Coach scores how well a sermon communicated. It does not judge whether the theology is correct, and a tradition-aware lens is used only if your workspace turns it on.",
      "Sermon Coach feedback is private to the person who recorded or uploaded the sermon. It isn't shown to other workspace members who can open the sermon, and it is never included in a shared link.",
      "The guide is written by AI from the transcript. Read it before you publish it.",
    ],
    faq: [
      {
        q: "Will it make up scripture references?",
        a: "It is instructed to include only references that are actually cited or clearly quoted in the transcript, and to return none if there are none. AI can still make mistakes, so check the guide against the sermon before you hand it out.",
      },
      {
        q: "Who can see the Sermon Coach feedback?",
        a: "Only the person who recorded or uploaded the sermon. Other workspace members who can open the sermon don't see it, and it is left out of public share links.",
      },
      {
        q: "Does the coach judge our theology?",
        a: "No. It evaluates communication — whether the main idea is clear, whether the points come from the passages cited, how the sermon is structured, and how it lands in application. If your workspace chooses a tradition, that is used as a lens for notes; otherwise the coach is told not to assess doctrine.",
      },
      {
        q: "Can I use a transcript I already have?",
        a: "Yes. You can paste a transcript instead of uploading audio.",
      },
    ],
    related: [
      { section: "solutions", slug: "podcasters" },
      { section: "features", slug: "notion-integration" },
    ],
  },
  {
    section: "solutions",
    slug: "podcasters",
    metaTitle: "AI Podcast Show Notes, Chapters & Quotes — MeetFlhow",
    metaDescription:
      "Upload an episode and get a transcript with speaker labels, an episode summary, a chapter outline and pull-quotes ready for social media.",
    navLabel: "Podcasters",
    eyebrow: "For podcasters",
    h1: "Show notes, chapters and pull-quotes from every episode",
    lede: "Upload a finished episode, or record it in your browser, and MeetFlhow drafts the parts you would otherwise write by hand after every release.",
    outputsHeading: "What you get from each episode",
    outputs: [
      {
        title: "Episode summary",
        body: "Two to three sentences written to work as an episode description.",
      },
      {
        title: "Chapter outline",
        body: "An ordered table of contents that breaks the episode into its main topics, with a one-sentence description for each.",
      },
      {
        title: "Pull-quotes",
        body: "Two to four short lines that were actually said in the episode, near-verbatim and written to be quoted on social media.",
      },
      {
        title: "Transcript with speaker labels",
        body: "A searchable transcript that separates speakers. You can name them, and if you enrol your voice MeetFlhow recognises you specifically instead of calling you “Speaker 1”.",
      },
      {
        title: "Share link",
        body: "Send a guest or collaborator the notes and transcript with a link, optionally password-protected.",
      },
    ],
    steps: [
      COMMON_CAPTURE_STEP,
      {
        title: "Choose the podcast content type",
        body: "The output is shaped for an episode — show notes, chapters and quotes — not a business-meeting summary.",
      },
      {
        title: "Copy the notes into your feed",
        body: "Review the draft on the episode's page and paste what you want into your show notes, newsletter or social posts.",
      },
    ],
    goodToKnow: [
      "Chapters are a titled outline with short descriptions. They don't include timestamps.",
      "Pull-quotes are told to be near-verbatim lines from the episode, never invented. Check them against the audio before you post.",
      "Everything is a draft written by AI from the transcript, so give it a read before it goes out.",
    ],
    faq: [
      {
        q: "Are the pull-quotes real?",
        a: "They are instructed to be near-verbatim lines actually said in the episode, not paraphrases or invented lines. Because AI can still slip, confirm each one against the recording before posting it.",
      },
      {
        q: "Does it give me chapter timestamps?",
        a: "Not today. You get an ordered list of chapter titles with a one-sentence description each, which you can add timestamps to in your podcast host.",
      },
      {
        q: "Can it tell my guest from me?",
        a: "It separates speakers in the transcript and lets you name them. If you enrol your voice once, it can recognise you specifically in later recordings.",
      },
      {
        q: "Can I send the notes somewhere else?",
        a: "Yes. You can push a meeting to Notion or Slack, and use Zapier or webhooks to send it to other tools.",
      },
    ],
    related: [
      { section: "solutions", slug: "churches" },
      { section: "features", slug: "notion-integration" },
    ],
  },
  {
    section: "solutions",
    slug: "sales-calls",
    metaTitle: "AI Sales Call Notes & Action Items — MeetFlhow",
    metaDescription:
      "Record a sales call and get a summary, decisions and action items with owners, live buying and risk flags, and a follow-up email draft.",
    navLabel: "Sales calls",
    eyebrow: "For sales teams",
    h1: "Sales call notes, action items and live buying signals",
    lede: "Know what was agreed and who owns what the moment the call ends — and see buying and risk phrases flagged while the call is still happening.",
    outputsHeading: "What you get from each call",
    outputs: [
      {
        title: "Summary, decisions and open questions",
        body: "A written summary of the call, the decisions that were made, and the questions still open.",
      },
      {
        title: "Action items with owners",
        body: "Tasks pulled from the conversation with an owner and a due date where one was mentioned. When a voice-verified speaker matches the owner, the item is assigned to their account.",
      },
      {
        title: "Live buying and risk flags",
        body: "While you record with live captions on, phrases such as “budget”, “pricing” and “next steps” are flagged as buying signals, and phrases such as “too expensive”, “competitor” and “need to check with” as risk.",
      },
      {
        title: "Follow-up email draft",
        body: "A draft follow-up email built from the call that you can edit and send.",
      },
      {
        title: "Talk-time balance",
        body: "See how much each person spoke, so you can tell when a call turned into a monologue.",
      },
      {
        title: "Send it where your team works",
        body: "Post the summary and action items to Slack, push the meeting to Notion, turn an action item into a Jira or Linear ticket, or use Zapier and webhooks to reach the rest of your stack.",
      },
    ],
    steps: [
      COMMON_CAPTURE_STEP,
      {
        title: "Watch the live flags (optional)",
        body: "Turn on live captions while you record to see buying and risk phrases appear as they are said.",
      },
      {
        title: "Review, assign and follow up",
        body: "Check the action items, send the follow-up, and push the notes to Slack or Notion.",
      },
    ],
    goodToKnow: [
      "The live flags are simple phrase matching against a fixed list of buying and risk phrases, run in your browser on the live captions. They catch obvious signals quickly; they don't read tone or intent.",
      "Summaries, decisions and action items are written by AI from the transcript. Read them before you act on them.",
    ],
    faq: [
      {
        q: "How does the live buying-signal detection work?",
        a: "It watches the live captions for a fixed list of phrases — for example “budget”, “pricing”, “when can we start”, “sign off” and “next steps” for buying, and “not sure”, “think about it”, “too expensive”, “competitor” and “not the right time” for risk. It is keyword matching, so it is quick but it doesn't understand context or tone.",
      },
      {
        q: "Does it work with my CRM?",
        a: "There is no native CRM integration. You can send meeting data to other tools with Zapier or webhooks.",
      },
      {
        q: "Who gets assigned an action item?",
        a: "The item records the owner mentioned in the call. When MeetFlhow has verified that speaker's voice and they match an account, the item is assigned to that account.",
      },
      {
        q: "Do I need live captions on?",
        a: "Only for the live flags. Summaries, decisions and action items come from the transcript after the call, however you recorded it.",
      },
    ],
    related: [
      { section: "features", slug: "slack-integration" },
      { section: "features", slug: "notion-integration" },
    ],
  },
  {
    section: "features",
    slug: "slack-integration",
    metaTitle: "Send Meeting Summaries to Slack — MeetFlhow",
    metaDescription:
      "Connect Slack and MeetFlhow posts each meeting's summary and action items, with owners and due dates, to the channel you choose.",
    navLabel: "Slack",
    eyebrow: "Slack integration",
    h1: "Send meeting summaries and action items to Slack",
    lede: "Connect Slack once and the notes land in the channel where your team already works, as soon as a meeting has been processed.",
    outputsHeading: "What gets posted",
    outputs: [
      {
        title: "Meeting summary",
        body: "The written summary, so people who missed the meeting can catch up in a few lines.",
      },
      {
        title: "Action items as a checklist",
        body: "Each task with its owner and due date when there is one.",
      },
      {
        title: "A link back to the meeting",
        body: "An “Open Meeting” button takes people to the full notes in MeetFlhow.",
      },
      {
        title: "You choose what is included",
        body: "Pick the channel, and switch the summary and the action items on or off separately.",
      },
    ],
    steps: [
      {
        title: "Connect Slack",
        body: "Authorise MeetFlhow for your Slack workspace from your workspace's integration settings.",
      },
      {
        title: "Pick a channel",
        body: "Choose where meeting notes should go and what to include.",
      },
      {
        title: "Meetings post themselves",
        body: "After a meeting is processed, the note is posted automatically. You can also post any meeting by hand.",
      },
    ],
    goodToKnow: [
      "Slack receives the summary and action items, not the transcript.",
      "Slack posting works for meetings that belong to a workspace.",
      "MeetFlhow can join public channels by itself. For a private channel, someone needs to invite the MeetFlhow app first.",
    ],
    faq: [
      {
        q: "Is anything posted automatically?",
        a: "Yes. Once Slack is connected and a channel is chosen, each processed meeting is posted automatically, and you can switch the summary or action items off. You can also post a meeting manually.",
      },
      {
        q: "Does Slack get the transcript?",
        a: "No. The message contains the summary and action items, plus a link back to the meeting in MeetFlhow.",
      },
      {
        q: "Can it post to a private channel?",
        a: "Yes, after someone invites the MeetFlhow app to that channel. Public channels are joined automatically.",
      },
    ],
    related: [
      { section: "solutions", slug: "sales-calls" },
      { section: "features", slug: "notion-integration" },
    ],
  },
  {
    section: "features",
    slug: "notion-integration",
    metaTitle: "Save Meeting Notes to Notion — MeetFlhow",
    metaDescription:
      "Push a meeting to a Notion database as a page with the summary, key decisions, action items as to-dos, and a transcript excerpt.",
    navLabel: "Notion",
    eyebrow: "Notion integration",
    h1: "Save meeting notes to Notion",
    lede: "Send any processed meeting to a Notion database of your choice and get a clean page instead of a document to write up.",
    outputsHeading: "What lands in Notion",
    outputs: [
      {
        title: "A page per meeting",
        body: "A new page in the database you choose, titled with the meeting's name.",
      },
      {
        title: "Summary and key decisions",
        body: "The summary as text, and the decisions as a bulleted list.",
      },
      {
        title: "Action items as to-dos",
        body: "Each task becomes an unchecked to-do with its owner and due date when there is one.",
      },
      {
        title: "A transcript excerpt",
        body: "The start of the transcript in a collapsed toggle, so the page stays easy to scan.",
      },
      {
        title: "Your database properties, filled in",
        body: "If your database has a Date (date), Platform (select), Duration (number, in minutes) or Status (select) property, MeetFlhow fills it in.",
      },
    ],
    steps: [
      {
        title: "Connect Notion",
        body: "Authorise MeetFlhow and share the database you want to use.",
      },
      {
        title: "Choose a database",
        body: "Pick where meeting pages should be created.",
      },
      {
        title: "Push a meeting",
        body: "Send a processed meeting to Notion from its page in MeetFlhow.",
      },
    ],
    goodToKnow: [
      "You send meetings to Notion yourself, one at a time, from the meeting's page.",
      "The page includes an excerpt of the transcript (the first 2,000 characters), not the full text. The full transcript stays in MeetFlhow.",
    ],
    faq: [
      {
        q: "Does it sync automatically?",
        a: "Not today. You push a meeting to Notion from its page when you want it there.",
      },
      {
        q: "Does the whole transcript go to Notion?",
        a: "No. The page carries a collapsed excerpt, the first 2,000 characters. The full transcript stays in MeetFlhow.",
      },
      {
        q: "Which properties does it fill in?",
        a: "The page title, plus Date, Platform, Duration and Status when your database has properties with exactly those names and the matching types: Date as a date, Platform and Status as select, Duration as a number of minutes. Other properties are left alone.",
      },
    ],
    related: [
      { section: "features", slug: "slack-integration" },
      { section: "solutions", slug: "podcasters" },
    ],
  },
];

export function getMarketingPage(section: MarketingSection, slug: string): MarketingPage | undefined {
  return MARKETING_PAGES.find((page) => page.section === section && page.slug === slug);
}

export function marketingPagesIn(section: MarketingSection): MarketingPage[] {
  return MARKETING_PAGES.filter((page) => page.section === section);
}

export function marketingPagePath(page: Pick<MarketingPage, "section" | "slug">): string {
  return `/${page.section}/${page.slug}`;
}
