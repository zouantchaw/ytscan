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

export type ChannelDashboard = ChannelSummary & {
  totalViews: number;
  averageViews: number;
  medianViews: number;
  totalDurationSec: number;
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
  mode: "text" | "semantic";
  channel: string | null;
  query: string;
  fallbackUsed?: boolean;
};
