import type { SermonCoachDimensionKey } from "@/types/analysis";

/**
 * Sermon Coach evaluation rubric. The single source for both the model's
 * instructions (lib/gemini/sermon-coach.ts) and the labels shown to the
 * preacher, so what's scored and what's displayed can't drift apart.
 *
 * Scope: how well the sermon *communicated*. None of these dimensions
 * judges whether the theology is correct — "scripture grounding" asks
 * whether the sermon's points visibly come from the passages the preacher
 * actually cited, not whether their reading of them is right.
 */
export interface RubricDimension {
  label: string;
  question: string;
  /** What a high (80+) score looks like. */
  strong: string;
  /** What a low (<50) score looks like. */
  weak: string;
}

export const SERMON_COACH_RUBRIC: Record<SermonCoachDimensionKey, RubricDimension> = {
  bigIdeaClarity: {
    label: "Big-idea clarity",
    question: "Could a listener state the sermon's one main idea in a sentence afterwards?",
    strong: "A single, memorable main idea is stated plainly and returned to; the points serve it.",
    weak: "Several competing ideas; the main point is never stated or shifts during the sermon.",
  },
  scriptureGrounding: {
    label: "Scripture grounding",
    question:
      "Are the sermon's main points visibly drawn from the passages the preacher cites or reads in this sermon?",
    strong: "Points are shown to arise from the cited text, which is read and explained in context.",
    weak: "Passages are cited but not engaged with, or the points could stand without them.",
  },
  structureAndFlow: {
    label: "Structure and flow",
    question: "Is there a clear progression with signposted movement from one section to the next?",
    strong: "Clear introduction, movements and landing; transitions tell the listener where they are.",
    weak: "Hard to follow; sections blur, loop back or end abruptly.",
  },
  applicationStrength: {
    label: "Application strength",
    question: "Does the sermon show concretely what the message means for listeners' lives this week?",
    strong: "Specific, realistic applications for different listeners, connected to the main idea.",
    weak: "Application is absent, generic (\"be better\"), or disconnected from the message.",
  },
  illustrationEffectiveness: {
    label: "Illustration effectiveness",
    question: "Do stories, images and examples illuminate the point they're attached to?",
    strong: "Illustrations are vivid, proportionate and clearly land the point they serve.",
    weak: "Illustrations are missing, overlong, or don't connect to the point being made.",
  },
  audienceAccessibility: {
    label: "Audience accessibility",
    question: "Could someone new to church follow it — jargon explained, assumptions stated?",
    strong: "Technical and insider terms are explained; the argument doesn't assume prior knowledge.",
    weak: "Unexplained jargon or assumed background would lose a newcomer.",
  },
  engagementAndDelivery: {
    label: "Engagement and delivery",
    question:
      "As far as the transcript shows: does the sermon invite attention — questions, direct address, varied pace?",
    strong: "Speaks to the listener directly, uses questions and tension, varies rhythm.",
    weak: "Monotone in structure, long unbroken exposition, little direct address.",
  },
};
