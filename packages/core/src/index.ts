export type ChannelSummary = {
  slug: string;
  channelName: string;
  channelUrl: string;
  channelYoutubeId: string | null;
  totalVideos: number;
  subscriberCount: number | null;
  scanDate: string;
};

export type VideoSummary = {
  youtubeId: string;
  title: string;
  uploadDate: string;
  durationSec: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  performanceTier: string;
  videoUrl: string;
};

export type HookSummary = {
  text: string;
  startTime: number;
  endTime: number;
  timestampLabel: string;
  wordCount: number;
  hookType: string;
  youtubeId: string;
  videoTitle: string;
  viewCount: number;
  videoUrl: string;
};

export type MetricDelta = {
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
};

export type DurationBucketSummary = {
  label: string;
  minSec: number;
  maxSec: number | null;
  videoCount: number;
  averageViews: number;
  medianViews: number;
  averageEngagementRate: number;
};

export type TopicClusterSummary = {
  topic: string;
  videoCount: number;
  averageViews: number;
  averageEngagementRate: number;
  shareOfChannel: number;
  topVideoTitle: string;
  topVideoYoutubeId: string;
  topVideoViewCount: number;
  exemplarVideoUrl: string;
};

export type TrendPoint = {
  period: string;
  uploads: number;
  totalViews: number;
  averageViews: number;
  averageEngagementRate: number;
  viralVideos: number;
  strongVideos: number;
};

export type PerformanceBreakdownItem = {
  tier: string;
  count: number;
  percentage: number;
};

export type DashboardStats = {
  averageViews: MetricDelta;
  averageEngagementRate: MetricDelta;
  uploadCadencePerWeek: MetricDelta;
  bestDuration: DurationBucketSummary | null;
};

export type ChannelDashboard = ChannelSummary & {
  totalViews: number;
  averageViews: number;
  medianViews: number;
  totalDurationSec: number;
  averageEngagementRate: number;
  stats: DashboardStats;
  durationBuckets: DurationBucketSummary[];
  performanceTrend: TrendPoint[];
  performanceBreakdown: PerformanceBreakdownItem[];
  topicClusters: TopicClusterSummary[];
  topVideos: VideoSummary[];
  topHooks: HookSummary[];
};

export type SearchResultItem = {
  vectorId: string;
  text: string;
  snippet: string;
  startTime: number;
  endTime: number;
  timestampLabel: string;
  youtubeId: string;
  title: string;
  uploadDate: string;
  viewCount: number;
  performanceTier: string;
  channelSlug: string;
  channelName: string;
  videoUrl: string;
  score?: number;
};

export type SearchResponse = {
  items: SearchResultItem[];
  count: number;
  videoCount: number;
  mode: "text" | "semantic";
  channel: string | null;
  query: string;
  fallbackUsed?: boolean;
};

export type HookLibraryResponse = {
  channel: string;
  items: HookSummary[];
  count: number;
  sort: "views" | "recent";
};

export type ChannelTopicsResponse = {
  channel: string;
  items: TopicClusterSummary[];
  count: number;
};

export type ChannelTrendsResponse = {
  channel: string;
  items: TrendPoint[];
  durationBuckets: DurationBucketSummary[];
  performanceBreakdown: PerformanceBreakdownItem[];
};

export type ChannelComparisonProfile = {
  slug: string;
  channelName: string;
  totalVideos: number;
  averageViews: number;
  medianViews: number;
  averageEngagementRate: number;
  uploadCadencePerWeek: number;
  bestDuration: DurationBucketSummary | null;
};

export type CompareTopicGap = {
  topic: string;
  missingOn: string;
  sourceChannel: string;
  videoCount: number;
  averageViews: number;
  opportunityScore: number;
  exemplarTitle: string;
  exemplarYoutubeId: string;
  exemplarVideoUrl: string;
};

export type CompareTopicOverlap = {
  topic: string;
  leftVideoCount: number;
  rightVideoCount: number;
  leftAverageViews: number;
  rightAverageViews: number;
  winnerSlug: string | null;
};

export type ChannelCompareResponse = {
  left: ChannelComparisonProfile;
  right: ChannelComparisonProfile;
  topicGaps: CompareTopicGap[];
  topicOverlap: CompareTopicOverlap[];
};

export type ScanJob = {
  jobId: string;
  channelUrl: string;
  requestedChannelSlug: string | null;
  status: string;
  stage: string;
  progress: number;
  totalVideos: number | null;
  processedVideos: number | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthenticatedUser = {
  email: string;
  emailVerified: boolean;
  id: string;
  image: string | null;
  name: string;
};

export type WorkspaceSummary = {
  createdAt: string;
  id: string;
  name: string;
  role: string;
  slug: string;
  updatedAt: string;
};

export type MeResponse = {
  user: AuthenticatedUser;
  workspace: WorkspaceSummary;
};
