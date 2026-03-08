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
  thumbnailAnalysis: ThumbnailAnalysisSummary | null;
};

export type ThumbnailAnalysisSummary = {
  provider: string;
  modelKey: string;
  textOverlay: string | null;
  textOverlayPresent: boolean;
  textPosition: string;
  textSize: string;
  hasFace: boolean;
  faceCount: number;
  expression: string | null;
  dominantColors: string[];
  compositionStyle: string;
  primarySubject: string | null;
  objects: string[];
  visualHook: string | null;
  whyItWorks: string | null;
  clarityScore: number | null;
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

export type ChannelVideosResponse = {
  channel: string;
  items: VideoSummary[];
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

export type JsonObject = Record<string, unknown>;

export type ScriptLabStep =
  | "hooks"
  | "outline"
  | "script"
  | "director_notes"
  | "thumbnail_brief"
  | "previs";

export type ScriptResearchItem = {
  id: string;
  itemType: string;
  sourceChannelSlug: string | null;
  sourceYoutubeId: string | null;
  sourceVectorId: string | null;
  title: string | null;
  excerpt: string | null;
  score: number | null;
  metadata: JsonObject;
  createdAt: string;
};

export type ScriptOutputVersion = {
  id: string;
  step: ScriptLabStep | string;
  version: number;
  modelKey: string | null;
  content: string;
  metadata: JsonObject;
  createdByUserId: string | null;
  createdAt: string;
};

export type ThumbnailBriefVersion = {
  id: string;
  version: number;
  content: string;
  metadata: JsonObject;
  createdAt: string;
};

export type GenerationJobSummary = {
  id: string;
  projectId: string | null;
  personaModelId: string | null;
  jobType: string;
  provider: string;
  providerJobId: string | null;
  status: string;
  stage: string;
  progress: number;
  input: JsonObject;
  output: JsonObject;
  message: string | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GenerationAssetSummary = {
  id: string;
  projectId: string | null;
  generationJobId: string | null;
  assetKind: string;
  variant: string | null;
  mimeType: string;
  fileName: string;
  byteSize: number | null;
  metadata: JsonObject;
  createdAt: string;
  downloadPath: string;
};

export type ScriptProjectSummary = {
  id: string;
  title: string;
  topic: string;
  status: string;
  channelSlug: string | null;
  channelName: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  researchItemCount: number;
  latestOutputStep: string | null;
  latestOutputVersion: number | null;
};

export type ScriptProjectDetail = ScriptProjectSummary & {
  researchItems: ScriptResearchItem[];
  outputs: ScriptOutputVersion[];
  thumbnailBriefs: ThumbnailBriefVersion[];
  generationJobs: GenerationJobSummary[];
  generatedAssets: GenerationAssetSummary[];
};

export type ScriptProjectListResponse = {
  items: ScriptProjectSummary[];
  count: number;
};

export type ScriptProjectResponse = {
  project: ScriptProjectDetail;
};

export type PersonaModelSummary = {
  id: string;
  channelSlug: string | null;
  channelName: string | null;
  status: string;
  provider: string;
  providerJobId: string | null;
  baseModel: string;
  adapterPath: string | null;
  datasetPath: string | null;
  datasetExamples: number;
  metadata: JsonObject;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonaModelDetail = PersonaModelSummary & {
  generationJobs: GenerationJobSummary[];
};

export type PersonaModelListResponse = {
  items: PersonaModelSummary[];
  count: number;
};

export type PersonaModelResponse = {
  personaModel: PersonaModelDetail;
};
