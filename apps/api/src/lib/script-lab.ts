import type {
  ChannelOpportunity,
  HookSummary,
  ScriptLabStep,
  TopicClusterSummary,
} from "@ytscan/core";

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
  opportunity: ChannelOpportunity | null;
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
  const personaNotes = takeTopResearch(researchItems, "persona_style", 3)
    .map((item) => {
      const prompt = cleanText(String(item.metadata.prompt ?? item.title ?? "Persona sample"));
      const excerpt = cleanText(item.excerpt);
      return excerpt ? `${prompt}: ${excerpt.slice(0, 160)}` : null;
    })
    .filter((value): value is string => Boolean(value));
  const hookNotes = topHooks
    .slice(0, 3)
    .map((hook) => `${hook.hookType}: ${cleanText(hook.text).slice(0, 140)}`);
  const quoteNotes = takeTopResearch(researchItems, "quote", 3)
    .map((item) => cleanText(item.excerpt))
    .filter(Boolean)
    .map((value) => value.slice(0, 160));
  return [...personaNotes, ...hookNotes, ...quoteNotes].slice(0, 6);
}

function formatOpportunityEvidenceLine(
  title: string,
  detail: string,
  supportingMetric: string | null | undefined
): string {
  const metricSuffix = supportingMetric ? ` (${supportingMetric})` : "";
  return `${title}${metricSuffix}: ${detail}`;
}

function findExistingOutput(existingOutputs: OutputLike[], step: string): OutputLike | null {
  const matches = existingOutputs
    .filter((output) => output.step === step)
    .sort((left, right) => right.version - left.version);
  return matches[0] ?? null;
}

function buildHookDraft(context: ScriptLabGenerationContext) {
  if (context.opportunity) {
    const channelProof = context.opportunity.channelEvidence
      .slice(0, 2)
      .map((item) => formatOpportunityEvidenceLine(item.title, item.detail, item.supportingMetric));
    const competitorProof = context.opportunity.competitorEvidence
      .slice(0, 2)
      .map((item) => formatOpportunityEvidenceLine(item.title, item.detail, item.supportingMetric));

    const proofPoints = [
      ...channelProof,
      ...competitorProof,
    ]
      .join("\n");

    return {
      content: [
        `# Hooks for ${context.projectTitle}`,
        "",
        "## Option 1 (recommended)",
        context.opportunity.recommendedHook,
        "",
        "## Option 2 (operator lens)",
        `${context.opportunity.topic} looks mainstream from the outside, but the money is in the version smart operators see before everyone else does.`,
        "",
        "## Option 3 (contrarian)",
        `The biggest mistake people make about ${context.opportunity.topic} is chasing the flashy story instead of the boring angle that actually compounds.`,
        "",
        "## Why these hooks should work",
        `${context.opportunity.whyNow} ${context.opportunity.rationale}`,
        "",
        "## Proof points to land in the opening",
        proofPoints || "- Pull the strongest example from the selected opportunity.",
      ].join("\n"),
      metadata: {
        source: "opportunity",
        opportunityId: context.opportunity.id,
        hookTypes: ["recommended", "angle-first", "contrarian"],
      },
    };
  }

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
  const personaAnchors = takeTopResearch(context.researchItems, "persona_style", 2)
    .map((item) => `- ${cleanText(item.excerpt).slice(0, 180)}`)
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
      ...(personaAnchors
        ? ["## Persona anchors", personaAnchors, ""]
        : []),
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
  if (context.opportunity) {
    const proofStack = [
      ...context.opportunity.channelEvidence,
      ...context.opportunity.competitorEvidence,
    ].slice(0, 4);

    return {
      content: [
        `# Outline for ${context.projectTitle}`,
        "",
        "## 1. Cold open",
        context.opportunity.recommendedHook,
        "",
        "## 2. Why the audience should care now",
        context.opportunity.whyNow,
        "",
        "## 3. Thesis",
        context.opportunity.angle,
        "",
        "## 4. Proof stack",
        ...proofStack.map((item) => `- ${formatOpportunityEvidenceLine(item.title, item.detail, item.supportingMetric)}`),
        ...(proofStack.length === 0 ? ["- Pull one channel-native winner and one competitor case study."] : []),
        "",
        "## 5. Decision rule",
        `Show the audience how to evaluate ${context.opportunity.topic} more like an owner and less like a spectator. Give them a concrete filter they can use next week.`,
        "",
        "## 6. Close",
        `End with the one question viewers should ask before they ever chase ${context.opportunity.topic}.`,
      ].join("\n"),
      metadata: {
        source: "opportunity",
        opportunityId: context.opportunity.id,
        recommendedFormat: context.opportunity.recommendedFormat,
      },
    };
  }

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
  if (context.opportunity) {
    const leadProof = context.opportunity.channelEvidence[0] ?? context.opportunity.competitorEvidence[0] ?? null;
    const secondaryProof = context.opportunity.competitorEvidence[0] ?? context.opportunity.channelEvidence[1] ?? null;

    return {
      content: [
        `# Script Draft: ${context.projectTitle}`,
        "",
        "## Voice targets",
        `- Direct, contrarian, practical, and operator-first for ${context.channelName}.`,
        `- Keep the frame on ${context.opportunity.topic}, but push toward what is misunderstood or underpriced.`,
        "",
        "## First-minute draft",
        context.opportunity.recommendedHook,
        "",
        `${context.opportunity.whyNow} That is exactly why this topic matters right now, because most people are still looking at the wrong part of the story.`,
        "",
        `Here is the angle I want to make clear from the start: ${context.opportunity.angle}`,
        "",
        leadProof
          ? `${leadProof.title}${leadProof.supportingMetric ? `, ${leadProof.supportingMetric},` : ""} is the proof point that makes this argument real. ${leadProof.detail}`
          : `${context.opportunity.rationale} So instead of repeating the usual advice, we are going to break down the version that actually matters to someone trying to build wealth through smart business decisions.`,
        "",
        "Most people tell the obvious version of this story. The better version is the one an operator sees before the crowd does.",
        secondaryProof
          ? `${secondaryProof.title}${secondaryProof.supportingMetric ? `, ${secondaryProof.supportingMetric},` : ""} is the comparison point that sharpens that contrast. ${secondaryProof.detail}`
          : `The job now is to break the audience out of the default framing and show them the real decision that sits underneath ${context.opportunity.topic}.`,
        "",
        `By the end of this opening minute, the viewer should know exactly what to look for, what to avoid, and why the boring version of ${context.opportunity.topic} might be the one with the best upside.`,
      ].join("\n"),
      metadata: {
        source: "opportunity",
        opportunityId: context.opportunity.id,
      },
    };
  }

  const outlineOutput = findExistingOutput(context.existingOutputs, "outline");
  const hooksOutput = findExistingOutput(context.existingOutputs, "hooks");
  const voiceNotes = formatVoiceNotes(context.topHooks, context.researchItems);
  const proofItems = takeTopResearch(context.researchItems, "quote", 3);
  const competitorItems = takeTopResearch(context.researchItems, "gap", 2);
  const personaSamples = takeTopResearch(context.researchItems, "persona_style", 2)
    .map((item) => cleanText(item.excerpt))
    .filter(Boolean);

  return {
    content: [
      `# Script Draft: ${context.projectTitle}`,
      "",
      "## Voice targets",
      ...voiceNotes.map((note) => `- ${note}`),
      ...(voiceNotes.length === 0 ? ["- Concrete, direct, and framed around asymmetric upside."] : []),
      "",
      "## Draft",
      hooksOutput
        ? takeSentences(hooksOutput.content, 1)[0]
        : personaSamples[0] || `If you want to understand ${context.topic}, stop starting with the obvious angle.`,
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
  if (context.opportunity) {
    const proofItem = context.opportunity.channelEvidence[0] ?? context.opportunity.competitorEvidence[0] ?? null;

    return {
      content: [
        `# Director's Notes: ${context.projectTitle}`,
        "",
        "## Opening visual grammar",
        "- Start on a direct talking-head line, then cut quickly to one concrete business artifact that proves the claim.",
        "- Use big on-screen text only for the contrarian angle and the money line.",
        "",
        "## Story beats",
        `- Beat 1: establish the obvious narrative around ${context.opportunity.topic}.`,
        `- Beat 2: hard pivot into the real angle: ${context.opportunity.angle}`,
        `- Beat 3: land the proof stack${proofItem ? ` starting with ${proofItem.title}` : " with one channel-native example and one market example"}.`,
        "",
        "## Editing notes",
        "- Use fast match cuts in the hook, then slow down slightly when the proof begins so the audience can process the business logic.",
        "- Keep lower-thirds concise. The argument should do the heavy lifting, not the labels.",
        "",
        "## Visual callbacks",
        `- Reuse thumbnail language around: ${context.opportunity.thumbnailDirection}`,
        `- Keep runtime in the ${context.opportunity.recommendedDuration} zone unless the proof stack clearly earns more time.`,
      ].join("\n"),
      metadata: {
        source: "opportunity",
        opportunityId: context.opportunity.id,
      },
    };
  }

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
  if (context.opportunity) {
    return {
      content: [
        `# Thumbnail Brief: ${context.projectTitle}`,
        "",
        "## Direction",
        context.opportunity.thumbnailDirection,
        "",
        "## Core promise",
        context.opportunity.angle,
        "",
        "## Text ideas",
        "- HIDDEN BUSINESS",
        "- THE REAL PLAY",
        "- NOBODY SEES THIS",
        "",
        "## Visual notes",
        `- Keep the image clearly tied to ${context.opportunity.topic}.`,
        "- One subject, one argument, one emotional read.",
        "- Optimize for instant curiosity, not full explanation.",
      ].join("\n"),
      metadata: {
        source: "opportunity",
        opportunityId: context.opportunity.id,
        conceptCount: 2,
      },
    };
  }

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
    ].join("\n"),
    metadata: {
      conceptCount: 2,
      sourceTopicCount: strongestTopics.length,
      sourceHookId: topHook?.youtubeId ?? null,
    },
  };
}

function buildPrevisBrief(context: ScriptLabGenerationContext) {
  if (context.opportunity) {
    const directorNotes = findExistingOutput(context.existingOutputs, "director_notes");
    const scriptOutput = findExistingOutput(context.existingOutputs, "script");

    return {
      content: [
        `# Previsualization Brief: ${context.projectTitle}`,
        "",
        "## Objective",
        `Render a rough 60-90 second intro animatic for ${context.opportunity.topic} that stress-tests the hook, argument, and visual direction before production.`,
        "",
        "## Story spine",
        context.opportunity.recommendedHook,
        context.opportunity.angle,
        context.opportunity.whyNow,
        "",
        "## Thumbnail continuity",
        context.opportunity.thumbnailDirection,
        "",
        "## Source material",
        directorNotes?.content.slice(0, 900) ?? "Generate director's notes before building the previs package.",
        "",
        scriptOutput ? "## Voiceover seed" : "## Voiceover reminder",
        scriptOutput?.content.slice(0, 900) ?? "Generate the script draft before producing previs assets.",
      ].join("\n"),
      metadata: {
        source: "opportunity",
        opportunityId: context.opportunity.id,
        sourceDirectorNotesVersion: directorNotes?.version ?? null,
        sourceScriptVersion: scriptOutput?.version ?? null,
        assetType: "previs_brief",
      },
    };
  }

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
