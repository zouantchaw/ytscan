import type {
  ChannelCompareResponse,
  ChannelComparisonProfile,
  CompareTopicGap,
  CompareTopicOverlap,
  DashboardStats,
  DurationBucketSummary,
  PerformanceBreakdownItem,
  ThumbnailAnalysisSummary,
  TopicClusterSummary,
  TrendPoint,
} from "@ytscan/core";

export type AnalyticsVideo = {
  youtubeId: string;
  title: string;
  uploadDate: string;
  durationSec: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  description: string;
  tags: string[];
  engagementRate: number;
  performanceTier: string;
  videoUrl: string;
  thumbnailAnalysis: ThumbnailAnalysisSummary | null;
};

type TopicAggregate = {
  topic: string;
  videoCount: number;
  totalViews: number;
  totalEngagementRate: number;
  topVideoTitle: string;
  topVideoYoutubeId: string;
  topVideoViewCount: number;
  exemplarVideoUrl: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW = 30;
const CADENCE_WINDOW_DAYS = 90;

const TOPIC_STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "almost",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "better",
  "big",
  "build",
  "buy",
  "buying",
  "by",
  "can",
  "change",
  "day",
  "days",
  "did",
  "do",
  "does",
  "doing",
  "dont",
  "else",
  "every",
  "fail",
  "fastest",
  "for",
  "forget",
  "from",
  "get",
  "go",
  "good",
  "greatest",
  "guide",
  "had",
  "has",
  "have",
  "heres",
  "how",
  "i",
  "id",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "ive",
  "just",
  "keep",
  "largest",
  "learn",
  "learned",
  "life",
  "literally",
  "make",
  "me",
  "million",
  "millionaire",
  "minutes",
  "month",
  "months",
  "my",
  "never",
  "no",
  "not",
  "now",
  "of",
  "on",
  "one",
  "only",
  "or",
  "other",
  "our",
  "out",
  "people",
  "possible",
  "profit",
  "proof",
  "really",
  "rich",
  "salary",
  "school",
  "secret",
  "should",
  "simple",
  "so",
  "start",
  "still",
  "super",
  "than",
  "talks",
  "taught",
  "that",
  "the",
  "their",
  "these",
  "they",
  "thing",
  "things",
  "this",
  "those",
  "through",
  "to",
  "too",
  "ultimate",
  "up",
  "video",
  "want",
  "wanted",
  "watch",
  "wealth",
  "week",
  "weekend",
  "what",
  "when",
  "why",
  "with",
  "work",
  "world",
  "would",
  "year",
  "years",
  "you",
  "your",
  "found",
  "founded",
  "founder",
  "bought",
  "asked",
  "m",
  "re",
  "ve",
  "ll",
  "d",
  "t",
]);

const GENERIC_TOPIC_TOKENS = new Set([
  "business",
  "businesses",
  "income",
  "job",
  "jobs",
  "money",
  "wealth",
  "rich",
  "millionaire",
  "millionaires",
  "million",
  "billionaire",
  "billionaires",
]);

const DURATION_BUCKETS = [
  { label: "0-8 min", minSec: 0, maxSec: 8 * 60 },
  { label: "8-12 min", minSec: 8 * 60, maxSec: 12 * 60 },
  { label: "12-18 min", minSec: 12 * 60, maxSec: 18 * 60 },
  { label: "18-30 min", minSec: 18 * 60, maxSec: 30 * 60 },
  { label: "30+ min", minSec: 30 * 60, maxSec: null },
] as const;

export function buildVideoUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

export function buildDashboardStats(videos: AnalyticsVideo[]): DashboardStats {
  const recentVideos = sortByUploadDateDesc(videos);
  const recentWindow = recentVideos.slice(0, Math.min(RECENT_WINDOW, recentVideos.length));
  const previousWindow = recentVideos.slice(recentWindow.length, recentWindow.length * 2);
  const durationBuckets = buildDurationBuckets(videos);
  const bestDuration =
    durationBuckets
      .filter((bucket) => bucket.videoCount > 0)
      .sort((left, right) => right.averageViews - left.averageViews)[0] ?? null;

  return {
    averageViews: buildMetricDelta(
      averageValue(recentWindow, (video) => video.viewCount),
      averageValue(previousWindow, (video) => video.viewCount)
    ),
    averageEngagementRate: buildMetricDelta(
      averageValue(recentWindow, (video) => video.engagementRate),
      averageValue(previousWindow, (video) => video.engagementRate)
    ),
    uploadCadencePerWeek: buildMetricDelta(
      computeCadencePerWeek(recentVideos, 0, CADENCE_WINDOW_DAYS),
      computeCadencePerWeek(recentVideos, CADENCE_WINDOW_DAYS, CADENCE_WINDOW_DAYS)
    ),
    bestDuration,
  };
}

export function buildDurationBuckets(videos: AnalyticsVideo[]): DurationBucketSummary[] {
  return DURATION_BUCKETS.map((bucket) => {
    const bucketVideos = videos.filter((video) => {
      const withinMin = video.durationSec >= bucket.minSec;
      const withinMax = bucket.maxSec === null ? true : video.durationSec < bucket.maxSec;
      return withinMin && withinMax;
    });

    return {
      label: bucket.label,
      minSec: bucket.minSec,
      maxSec: bucket.maxSec,
      videoCount: bucketVideos.length,
      averageViews: Math.round(averageValue(bucketVideos, (video) => video.viewCount)),
      medianViews: computeMedian(bucketVideos.map((video) => video.viewCount)),
      averageEngagementRate: roundTo(averageValue(bucketVideos, (video) => video.engagementRate), 4),
    };
  });
}

export function buildPerformanceTrend(videos: AnalyticsVideo[]): TrendPoint[] {
  const aggregates = new Map<
    string,
    {
      uploads: number;
      totalViews: number;
      totalEngagementRate: number;
      viralVideos: number;
      strongVideos: number;
    }
  >();

  for (const video of videos) {
    const period = normalizePeriod(video.uploadDate);
    const current = aggregates.get(period) ?? {
      uploads: 0,
      totalViews: 0,
      totalEngagementRate: 0,
      viralVideos: 0,
      strongVideos: 0,
    };

    current.uploads += 1;
    current.totalViews += video.viewCount;
    current.totalEngagementRate += video.engagementRate;
    if (video.performanceTier === "viral") current.viralVideos += 1;
    if (video.performanceTier === "strong") current.strongVideos += 1;

    aggregates.set(period, current);
  }

  return [...aggregates.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, aggregate]) => ({
      period,
      uploads: aggregate.uploads,
      totalViews: aggregate.totalViews,
      averageViews: Math.round(aggregate.totalViews / Math.max(aggregate.uploads, 1)),
      averageEngagementRate: roundTo(
        aggregate.totalEngagementRate / Math.max(aggregate.uploads, 1),
        4
      ),
      viralVideos: aggregate.viralVideos,
      strongVideos: aggregate.strongVideos,
    }));
}

export function buildPerformanceBreakdown(videos: AnalyticsVideo[]): PerformanceBreakdownItem[] {
  const tierOrder = ["viral", "strong", "average", "underperform"];
  const counts = new Map<string, number>();
  for (const video of videos) {
    counts.set(video.performanceTier, (counts.get(video.performanceTier) ?? 0) + 1);
  }

  return tierOrder.map((tier) => {
    const count = counts.get(tier) ?? 0;
    return {
      tier,
      count,
      percentage: roundTo(count / Math.max(videos.length, 1), 4),
    };
  });
}

export function buildTopicClusters(videos: AnalyticsVideo[], limit = 8): TopicClusterSummary[] {
  const aggregates = new Map<string, TopicAggregate>();

  for (const video of videos) {
    const topics = extractTopics(video);
    for (const topic of topics) {
      const current = aggregates.get(topic) ?? {
        topic,
        videoCount: 0,
        totalViews: 0,
        totalEngagementRate: 0,
        topVideoTitle: video.title,
        topVideoYoutubeId: video.youtubeId,
        topVideoViewCount: video.viewCount,
        exemplarVideoUrl: video.videoUrl,
      };

      current.videoCount += 1;
      current.totalViews += video.viewCount;
      current.totalEngagementRate += video.engagementRate;

      if (video.viewCount > current.topVideoViewCount) {
        current.topVideoTitle = video.title;
        current.topVideoYoutubeId = video.youtubeId;
        current.topVideoViewCount = video.viewCount;
        current.exemplarVideoUrl = video.videoUrl;
      }

      aggregates.set(topic, current);
    }
  }

  return [...aggregates.values()]
    .filter((aggregate) => aggregate.videoCount > 0)
    .sort((left, right) => {
      if (right.videoCount !== left.videoCount) {
        return right.videoCount - left.videoCount;
      }
      return right.totalViews - left.totalViews;
    })
    .slice(0, limit)
    .map((aggregate) => ({
      topic: aggregate.topic,
      videoCount: aggregate.videoCount,
      averageViews: Math.round(aggregate.totalViews / Math.max(aggregate.videoCount, 1)),
      averageEngagementRate: roundTo(
        aggregate.totalEngagementRate / Math.max(aggregate.videoCount, 1),
        4
      ),
      shareOfChannel: roundTo(aggregate.videoCount / Math.max(videos.length, 1), 4),
      topVideoTitle: aggregate.topVideoTitle,
      topVideoYoutubeId: aggregate.topVideoYoutubeId,
      topVideoViewCount: aggregate.topVideoViewCount,
      exemplarVideoUrl: aggregate.exemplarVideoUrl,
    }));
}

export function buildComparison(
  left: {
    slug: string;
    channelName: string;
    totalVideos: number;
    averageViews: number;
    medianViews: number;
    averageEngagementRate: number;
    uploadCadencePerWeek: number;
    bestDuration: DurationBucketSummary | null;
    topicClusters: TopicClusterSummary[];
  },
  right: {
    slug: string;
    channelName: string;
    totalVideos: number;
    averageViews: number;
    medianViews: number;
    averageEngagementRate: number;
    uploadCadencePerWeek: number;
    bestDuration: DurationBucketSummary | null;
    topicClusters: TopicClusterSummary[];
  }
): ChannelCompareResponse {
  const leftProfile: ChannelComparisonProfile = {
    slug: left.slug,
    channelName: left.channelName,
    totalVideos: left.totalVideos,
    averageViews: left.averageViews,
    medianViews: left.medianViews,
    averageEngagementRate: left.averageEngagementRate,
    uploadCadencePerWeek: left.uploadCadencePerWeek,
    bestDuration: left.bestDuration,
  };

  const rightProfile: ChannelComparisonProfile = {
    slug: right.slug,
    channelName: right.channelName,
    totalVideos: right.totalVideos,
    averageViews: right.averageViews,
    medianViews: right.medianViews,
    averageEngagementRate: right.averageEngagementRate,
    uploadCadencePerWeek: right.uploadCadencePerWeek,
    bestDuration: right.bestDuration,
  };

  const leftTopics = new Map(left.topicClusters.map((topic) => [topic.topic, topic]));
  const rightTopics = new Map(right.topicClusters.map((topic) => [topic.topic, topic]));
  const topicGaps: CompareTopicGap[] = [];
  const topicOverlap: CompareTopicOverlap[] = [];

  for (const [topic, cluster] of leftTopics.entries()) {
    const match = rightTopics.get(topic);
    if (!match) {
      topicGaps.push(toTopicGap(cluster, right.slug, left.slug));
      continue;
    }

    topicOverlap.push({
      topic,
      leftVideoCount: cluster.videoCount,
      rightVideoCount: match.videoCount,
      leftAverageViews: cluster.averageViews,
      rightAverageViews: match.averageViews,
      winnerSlug:
        cluster.averageViews === match.averageViews
          ? null
          : cluster.averageViews > match.averageViews
            ? left.slug
            : right.slug,
    });
  }

  for (const [topic, cluster] of rightTopics.entries()) {
    if (leftTopics.has(topic)) continue;
    topicGaps.push(toTopicGap(cluster, left.slug, right.slug));
  }

  topicGaps.sort((leftGap, rightGap) => rightGap.opportunityScore - leftGap.opportunityScore);
  topicOverlap.sort(
    (leftOverlap, rightOverlap) =>
      Math.abs(rightOverlap.leftAverageViews - rightOverlap.rightAverageViews) -
      Math.abs(leftOverlap.leftAverageViews - leftOverlap.rightAverageViews)
  );

  return {
    left: leftProfile,
    right: rightProfile,
    topicGaps: topicGaps.slice(0, 12),
    topicOverlap: topicOverlap.slice(0, 12),
  };
}

export function computeMedian(values: number[]): number {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[midpoint - 1] + sorted[midpoint]) / 2);
  }
  return sorted[midpoint] ?? 0;
}

function buildMetricDelta(current: number, previous: number) {
  const delta = current - previous;
  return {
    current: roundMetricValue(current),
    previous: roundMetricValue(previous),
    delta: roundMetricValue(delta),
    deltaPct: previous === 0 ? null : roundTo(delta / previous, 4),
  };
}

function computeCadencePerWeek(
  videos: AnalyticsVideo[],
  offsetDays: number,
  durationDays: number
): number {
  if (videos.length === 0) return 0;

  const sortedDates = videos
    .map((video) => parseUploadDate(video.uploadDate))
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((left, right) => right - left);

  if (sortedDates.length === 0) return 0;
  const newest = sortedDates[0];

  const windowEnd = newest - offsetDays * DAY_MS;
  const windowStart = windowEnd - durationDays * DAY_MS;

  const count = sortedDates.filter((value) => value > windowStart && value <= windowEnd).length;
  return count / (durationDays / 7);
}

function averageValue<T>(items: T[], selector: (item: T) => number): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + selector(item), 0);
  return total / items.length;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundMetricValue(value: number): number {
  if (Math.abs(value) >= 100) return Math.round(value);
  return roundTo(value, 4);
}

function normalizePeriod(uploadDate: string): string {
  const normalized = uploadDate.trim();
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}`;
  }
  return normalized.slice(0, 7);
}

function sortByUploadDateDesc(videos: AnalyticsVideo[]): AnalyticsVideo[] {
  return [...videos].sort(
    (left, right) => (parseUploadDate(right.uploadDate) ?? 0) - (parseUploadDate(left.uploadDate) ?? 0)
  );
}

function extractTopics(video: AnalyticsVideo): string[] {
  const titleCandidates = scoreTopicCandidates(video.title, 1);
  const tagCandidates = video.tags.map((tag) => ({
    topic: prettifyTopic(tag),
    score: 8,
  }));

  const ranked = new Map<string, number>();
  for (const candidate of [...titleCandidates, ...tagCandidates]) {
    const topic = normalizeTopic(candidate.topic);
    if (!topic) continue;
    ranked.set(topic, Math.max(ranked.get(topic) ?? 0, candidate.score));
  }

  return [...ranked.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([topic]) => topic)
    .slice(0, 1);
}

function scoreTopicCandidates(source: string, weight: number): Array<{ topic: string; score: number }> {
  if (!source) return [];

  const normalized = normalizeTopicSource(source)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const rawTokens = normalized
    .split(" ")
    .filter(Boolean)
    .filter((token) => !TOPIC_STOP_WORDS.has(token))
    .filter((token) => !/^\d+$/.test(token));

  const candidates = new Map<string, number>();
  const maxTokens = Math.min(rawTokens.length, 18);

  for (let size = 3; size >= 2; size -= 1) {
    for (let index = 0; index <= maxTokens - size; index += 1) {
      const tokens = rawTokens.slice(index, index + size);
      if (tokens.length !== size) continue;
      if (tokens.every((token) => GENERIC_TOPIC_TOKENS.has(token))) continue;

      const topic = prettifyTopic(tokens.join(" "));
      if (!topic) continue;

      const specificTokenCount = tokens.filter((token) => !GENERIC_TOPIC_TOKENS.has(token)).length;
      const score = (size * 10 + specificTokenCount * 4 - index * 0.4) * weight;
      candidates.set(topic, Math.max(candidates.get(topic) ?? 0, score));
    }
  }

  if (candidates.size === 0) {
    for (const [index, token] of rawTokens.entries()) {
      if (GENERIC_TOPIC_TOKENS.has(token) || token.length < 4) continue;
      const topic = prettifyTopic(token);
      if (!topic) continue;
      const score = (10 - index * 0.4) * weight;
      candidates.set(topic, Math.max(candidates.get(topic) ?? 0, score));
    }
  }

  return [...candidates.entries()].map(([topic, score]) => ({ topic, score }));
}

function cleanDescription(description: string): string {
  const sanitized = normalizeTopicSource(description)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) return "";
  return sanitized.split(/[.!?]/)[0]?.slice(0, 160) ?? "";
}

function normalizeTopic(topic: string): string {
  const cleaned = prettifyTopic(topic)
    .replace(/\b(codie|cody|sanchez|sanches|samchez|contrarian|thinking|learn)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length < 4) return "";
  if (GENERIC_TOPIC_TOKENS.has(cleaned.toLowerCase())) return "";
  return cleaned;
}

function prettifyTopic(topic: string): string {
  const normalized = normalizeTopicSource(topic)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  return normalized
    .split(" ")
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

function normalizeTopicSource(value: string): string {
  return value.normalize("NFKD").replace(/[^\x00-\x7F]/g, " ");
}

function parseUploadDate(value: string): number | null {
  const normalized = value.trim();
  if (/^\d{8}$/.test(normalized)) {
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6));
    const day = Number(normalized.slice(6, 8));
    return Date.UTC(year, month - 1, day);
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTopicGap(
  cluster: TopicClusterSummary,
  missingOn: string,
  sourceChannel: string
): CompareTopicGap {
  const opportunityScore = Math.round(
    cluster.averageViews * (1 + cluster.shareOfChannel) * Math.log2(cluster.videoCount + 1)
  );

  return {
    topic: cluster.topic,
    missingOn,
    sourceChannel,
    videoCount: cluster.videoCount,
    averageViews: cluster.averageViews,
    opportunityScore,
    exemplarTitle: cluster.topVideoTitle,
    exemplarYoutubeId: cluster.topVideoYoutubeId,
    exemplarVideoUrl: cluster.exemplarVideoUrl,
  };
}
