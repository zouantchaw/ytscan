import type { HookSummary, ScriptLabStep, TopicClusterSummary } from "@ytscan/core";

type ResearchItemLike = {
  excerpt: string | null;
  itemType: string;
  metadata: Record<string, unknown>;
  score: number | null;
  title: string | null;
};

type OutputLike = {
  content: string;
  step: string;
  version: number;
};

type TranscriptPassage = {
  text: string;
  title: string;
  youtubeId: string;
};

export type ScriptLabGenerationContext = {
  channelName: string;
  channelSlug: string;
  existingOutputs: OutputLike[];
  projectTitle: string;
  researchItems: ResearchItemLike[];
  topic: string;
  topicClusters: TopicClusterSummary[];
  topHooks: HookSummary[];
};

const HOOK_TYPE_TEMPLATES: Record<string, string[]> = {
  question: [
    "What if {topic} is the simplest leverage play most people still ignore?",
    "Why does {topic} look boring until you see how the winners actually structure it?",
  ],
  shock: [
    "{topic} sounds small until you realize how much money gets left on the table.",
    "Almost nobody looks at {topic} the right way, and that is exactly why the upside is still there.",
  ],
  stat: [
    "The channels winning on {topic} are not more creative. They just start with sharper proof.",
    "If you want {topic} to work on YouTube, the opening thirty seconds have to earn the next ten minutes.",
  ],
  story: [
    "The first time I studied {topic}, the obvious angle was the weakest one.",
    "There is a reason smart operators keep coming back to {topic}, and it is not the reason people think.",
  ],
  unknown: [
    "{topic} works best when you stop talking about it like theory and start framing it like a bet.",
    "The fastest way to make {topic} compelling is to show the gap between what people assume and what is actually true.",
  ],
};

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function takeSentences(value: string, limit: number): string[] {
  return cleanText(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function takeTopResearch(
  researchItems: ResearchItemLike[],
  itemType: string,
  limit: number
): ResearchItemLike[] {
  return researchItems
    .filter((item) => item.itemType === itemType)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, limit);
}

function formatReference(item: ResearchItemLike): string {
  const title = cleanText(item.title);
  const excerpt = cleanText(item.excerpt);
  const source = cleanText(String(item.metadata.videoTitle ?? item.metadata.videoUrl ?? ""));
  return [title || null, excerpt || null, source || null].filter(Boolean).join(" | ");
}

function formatVoiceNotes(topHooks: HookSummary[], researchItems: ResearchItemLike[]): string[] {
  const hookNotes = topHooks
    .slice(0, 3)
    .map((hook) => `${hook.hookType}: ${cleanText(hook.text).slice(0, 140)}`);
  const quoteNotes = takeTopResearch(researchItems, "quote", 3)
    .map((item) => cleanText(item.excerpt))
    .filter(Boolean)
    .map((value) => value.slice(0, 160));
  return [...hookNotes, ...quoteNotes].slice(0, 5);
}

function findExistingOutput(existingOutputs: OutputLike[], step: string): OutputLike | null {
  const matches = existingOutputs
    .filter((output) => output.step === step)
    .sort((left, right) => right.version - left.version);
  return matches[0] ?? null;
}

function buildHookDraft(context: ScriptLabGenerationContext) {
  const patterns = context.topHooks
    .map((hook) => hook.hookType || "unknown")
    .filter(Boolean)
    .slice(0, 3);
  const uniquePatterns = [...new Set(patterns.length ? patterns : ["question", "shock", "stat"])];
  const hooks = uniquePatterns.map((pattern, index) => {
    const templates = HOOK_TYPE_TEMPLATES[pattern] ?? HOOK_TYPE_TEMPLATES.unknown;
    return {
      hookType: pattern,
      text: templates[index % templates.length].replaceAll("{topic}", context.topic),
    };
  });

  const proofPoints = takeTopResearch(context.researchItems, "quote", 3)
    .map((item) => `- ${formatReference(item)}`)
    .join("\n");

  return {
    content: [
      `# Hooks for ${context.projectTitle}`,
      "",
      ...hooks.flatMap((hook, index) => [
        `## Option ${index + 1} (${hook.hookType})`,
        hook.text,
        "",
      ]),
      "## Proof points to support the opening",
      proofPoints || "- No direct transcript hits yet. Use the channel's strongest existing examples first.",
    ].join("\n"),
    metadata: {
      hookTypes: hooks.map((hook) => hook.hookType),
      sourceHookCount: context.topHooks.length,
      sourceQuoteCount: takeTopResearch(context.researchItems, "quote", 10).length,
    },
  };
}

function buildOutlineDraft(context: ScriptLabGenerationContext) {
  const hookOutput = findExistingOutput(context.existingOutputs, "hooks");
  const leadingHook = hookOutput
    ? takeSentences(hookOutput.content, 2)[0]
    : buildHookDraft(context).content.split("\n").find((line) => line.startsWith("What") || line.startsWith("Why") || line.startsWith("Almost")) ?? "";
  const proofItems = takeTopResearch(context.researchItems, "quote", 3);
  const gapItems = takeTopResearch(context.researchItems, "gap", 2);
  const topicItems = context.topicClusters.slice(0, 3);

  return {
    content: [
      `# Outline for ${context.projectTitle}`,
      "",
      "## 1. Cold open",
      leadingHook || `Lead with the most counterintuitive claim about ${context.topic}.`,
      "",
      "## 2. Why this matters now",
      `Explain why ${context.topic} is timely for ${context.channelName}'s audience and anchor it in a real operator insight.`,
      "",
      "## 3. Proof and examples",
      ...proofItems.map((item) => `- ${formatReference(item)}`),
      ...(proofItems.length === 0 ? ["- Pull one strong transcript clip and one real-world operator example."] : []),
      "",
      "## 4. Angle differentiation",
      ...gapItems.map(
        (item) => `- Opportunity: ${cleanText(item.title) || cleanText(item.excerpt) || "Unpack a competitor blind spot."}`
      ),
      ...(gapItems.length === 0 ? ["- Contrast the creator's take against the usual internet advice."] : []),
      "",
      "## 5. Supporting beats",
      ...topicItems.map((topic) => `- Tie back to the channel's proven lane: ${topic.topic}`),
      ...(topicItems.length === 0 ? ["- Use one supporting beat that connects the topic to a repeatable business pattern."] : []),
      "",
      "## 6. Close",
      `End with a direct takeaway and a next move the viewer can actually test inside ${context.topic}.`,
    ].join("\n"),
    metadata: {
      reusedExistingHooks: Boolean(hookOutput),
      sourceGapCount: gapItems.length,
      sourceTopicCount: topicItems.length,
    },
  };
}

function buildScriptDraft(context: ScriptLabGenerationContext) {
  const outlineOutput = findExistingOutput(context.existingOutputs, "outline");
  const hooksOutput = findExistingOutput(context.existingOutputs, "hooks");
  const voiceNotes = formatVoiceNotes(context.topHooks, context.researchItems);
  const proofItems = takeTopResearch(context.researchItems, "quote", 3);
  const competitorItems = takeTopResearch(context.researchItems, "gap", 2);

  return {
    content: [
      `# Script Draft: ${context.projectTitle}`,
      "",
      "## Voice targets",
      ...voiceNotes.map((note) => `- ${note}`),
      ...(voiceNotes.length === 0 ? ["- Concrete, direct, and framed around asymmetric upside."] : []),
      "",
      "## Draft",
      hooksOutput ? takeSentences(hooksOutput.content, 1)[0] : `If you want to understand ${context.topic}, stop starting with the obvious angle.`,
      "",
      `Most people approach ${context.topic} like a content category. ${context.channelName} should frame it like an edge. The point is not that ${context.topic} exists. The point is why the opportunity still feels mispriced, who is compounding inside it, and what the audience can copy before it gets crowded.`,
      "",
      proofItems[0]
        ? `Start with proof. ${cleanText(proofItems[0].excerpt)}`
        : `Start with proof. Pull the strongest transcript quote that shows the creator talking about ${context.topic} in plain language.`,
      "",
      proofItems[1]
        ? `Then widen the lens. ${cleanText(proofItems[1].excerpt)}`
        : `Then widen the lens with one more example that shows the model, not just the anecdote.`,
      "",
      competitorItems[0]
        ? `This is also where the differentiation lands. Competitors are winning attention on ${cleanText(competitorItems[0].title) || context.topic}, which means the script should explicitly say why ${context.channelName} sees the market differently.`
        : `This is also where the differentiation lands. Spell out why the creator's operating view beats the generic online advice.`,
      "",
      `Close by collapsing the lesson into a decision rule: what to notice first, what to avoid, and what a viewer should test next if they want to use ${context.topic} as leverage instead of noise.`,
      "",
      outlineOutput ? "## Structural source" : "## Structural reminder",
      outlineOutput?.content ?? `Build the final polish from the outline once the hook and proof beats are locked.`,
    ].join("\n"),
    metadata: {
      sourceOutlineVersion: outlineOutput?.version ?? null,
      sourceHooksVersion: hooksOutput?.version ?? null,
      voiceNotes,
    },
  };
}

function buildDirectorNotesDraft(context: ScriptLabGenerationContext) {
  const scriptOutput = findExistingOutput(context.existingOutputs, "script");
  const sceneSources = takeTopResearch(context.researchItems, "quote", 5);
  const referenceHook = context.topHooks[0];

  return {
    content: [
      `# Director's Notes: ${context.projectTitle}`,
      "",
      "## Scene 1",
      `Visual: direct-to-camera open with a fast push-in on the line "${referenceHook ? cleanText(referenceHook.text) : context.topic}".`,
      "On-screen text: one sharp claim, six words max.",
      "Transition: hard cut into proof.",
      "",
      "## Scene 2",
      `Visual: B-roll that grounds ${context.topic} in a real operator workflow, spreadsheet, storefront, or field footage.`,
      `Reference: ${formatReference(sceneSources[0] ?? { excerpt: null, itemType: "", metadata: {}, score: null, title: null }) || "Use the best transcript proof clip."}`,
      "",
      "## Scene 3",
      "Visual: kinetic text callouts for the numbers, downside, and decision criteria.",
      `Narrative job: translate the abstract lesson into one crisp rule the audience can repeat.`,
      "",
      "## Scene 4",
      `Visual: contrast board showing where competitors frame ${context.topic} one way and ${context.channelName} frames it another.`,
      `Reference: ${formatReference(sceneSources[1] ?? { excerpt: null, itemType: "", metadata: {}, score: null, title: null }) || "Pull the second-best transcript quote."}`,
      "",
      "## Scene 5",
      "Visual: return to creator, slower cadence, stronger eye contact.",
      "CTA: end on a decision and a next move, not a vague motivation line.",
      "",
      scriptOutput ? "## Script source" : "## Script reminder",
      scriptOutput?.content.slice(0, 1200) ?? "Generate the script draft first, then tighten each scene around a single visual beat.",
    ].join("\n"),
    metadata: {
      sourceScriptVersion: scriptOutput?.version ?? null,
      sceneCount: 5,
    },
  };
}

function buildThumbnailBriefDraft(context: ScriptLabGenerationContext) {
  const strongestTopics = context.topicClusters.slice(0, 3).map((item) => item.topic);
  const topHook = context.topHooks[0];

  return {
    content: [
      `# Thumbnail Brief: ${context.projectTitle}`,
      "",
      "## Concept 1",
      `Headline: ${context.topic.toUpperCase().slice(0, 28)}`,
      `Frame: ${context.channelName} foregrounded with one concrete prop tied to ${strongestTopics[0] ?? context.topic}.`,
      "Emotion: skeptical confidence, not surprise for the sake of surprise.",
      "",
      "## Concept 2",
      `Headline: WHY THIS WORKS`,
      `Frame: split-screen before/after visual showing the bad default versus the contrarian angle.`,
      `Proof to echo: ${topHook ? cleanText(topHook.text).slice(0, 120) : `The clearest claim from the ${context.topic} draft.`}`,
      "",
      "## Concept 3",
      `Headline: ${strongestTopics[1]?.toUpperCase().slice(0, 24) ?? "MISPRICED EDGE"}`,
      "Frame: big single object, minimal background noise, one dominant contrast color.",
      "Rule: one idea, one face, one proof cue.",
    ].join("\n"),
    metadata: {
      sourceTopicCount: strongestTopics.length,
      sourceHookId: topHook?.youtubeId ?? null,
    },
  };
}

function buildPrevisBrief(context: ScriptLabGenerationContext) {
  const directorNotes = findExistingOutput(context.existingOutputs, "director_notes");
  const scriptOutput = findExistingOutput(context.existingOutputs, "script");

  return {
    content: [
      `# Previsualization Brief: ${context.projectTitle}`,
      "",
      "## Objective",
      `Render a rough 60-90 second intro animatic for ${context.topic} that lets the team approve story direction before production.`,
      "",
      "## Assembly order",
      "- Scene cards from the director's notes",
      "- Temporary voiceover from the script opening",
      "- Text overlays for the main proof points",
      "- Hard-cut timing placeholders for each visual beat",
      "",
      "## Source material",
      directorNotes?.content.slice(0, 900) ?? "Generate director's notes before building the previs package.",
      "",
      scriptOutput ? "## Voiceover seed" : "## Voiceover reminder",
      scriptOutput?.content.slice(0, 900) ?? "Generate the script draft before producing previs assets.",
    ].join("\n"),
    metadata: {
      sourceDirectorNotesVersion: directorNotes?.version ?? null,
      sourceScriptVersion: scriptOutput?.version ?? null,
      assetType: "previs_brief",
    },
  };
}

export function generateScriptLabStep(
  step: ScriptLabStep,
  context: ScriptLabGenerationContext
): { content: string; metadata: Record<string, unknown> } {
  switch (step) {
    case "hooks":
      return buildHookDraft(context);
    case "outline":
      return buildOutlineDraft(context);
    case "script":
      return buildScriptDraft(context);
    case "director_notes":
      return buildDirectorNotesDraft(context);
    case "thumbnail_brief":
      return buildThumbnailBriefDraft(context);
    case "previs":
      return buildPrevisBrief(context);
    default:
      return {
        content: `# ${context.projectTitle}\n\nNo generator is defined for step "${step}".`,
        metadata: {},
      };
  }
}

export function buildPersonaDatasetLines(params: {
  channelName: string;
  channelSlug: string;
  topHooks: HookSummary[];
  transcriptPassages: TranscriptPassage[];
}): { exampleCount: number; lines: string[]; metadata: Record<string, unknown> } {
  const hookLines = params.topHooks.slice(0, 120).map((hook) =>
    JSON.stringify({
      messages: [
        {
          role: "system",
          content: `You are writing in ${params.channelName}'s YouTube voice. Stay concrete, direct, and persuasive.`,
        },
        {
          role: "user",
          content: `Write a high-retention ${hook.hookType || "opening"} hook in ${params.channelName}'s style.`,
        },
        {
          role: "assistant",
          content: cleanText(hook.text),
        },
      ],
      metadata: {
        channelSlug: params.channelSlug,
        source: "hook",
        videoTitle: hook.videoTitle,
        youtubeId: hook.youtubeId,
      },
    })
  );

  const passageLines = params.transcriptPassages.slice(0, 900).map((passage) =>
    JSON.stringify({
      messages: [
        {
          role: "system",
          content: `You are writing in ${params.channelName}'s YouTube voice. Keep the pacing sharp and the explanation actionable.`,
        },
        {
          role: "user",
          content: `Write a short passage in ${params.channelName}'s style about ${passage.title}.`,
        },
        {
          role: "assistant",
          content: cleanText(passage.text),
        },
      ],
      metadata: {
        channelSlug: params.channelSlug,
        source: "transcript_chunk",
        videoTitle: passage.title,
        youtubeId: passage.youtubeId,
      },
    })
  );

  const lines = [...hookLines, ...passageLines].filter(Boolean);
  return {
    exampleCount: lines.length,
    lines,
    metadata: {
      channelSlug: params.channelSlug,
      hookExamples: hookLines.length,
      transcriptExamples: passageLines.length,
    },
  };
}
