import { initialsFromName } from "@/lib/formatters";

const SEARCH_PROMPTS: Record<string, string> = {
  "codie-sanchez": "What has Codie said about laundromats?",
  johnnyharris: "What has Johnny said about JFK?",
};

const CHANNEL_STYLES: Record<
  string,
  {
    avatar: string;
    header: string;
  }
> = {
  "codie-sanchez": {
    avatar: "bg-primary text-white",
    header: "bg-[#1A1A18]",
  },
  johnnyharris: {
    avatar: "bg-[#8B8880] text-white",
    header: "bg-[#34342F]",
  },
};

export function getChannelHandle(channelUrl: string | null | undefined, fallbackSlug: string) {
  if (!channelUrl) return `@${fallbackSlug}`;

  try {
    const url = new URL(channelUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const finalSegment = segments.at(-1);
    return finalSegment ? (finalSegment.startsWith("@") ? finalSegment : `@${finalSegment}`) : `@${fallbackSlug}`;
  } catch {
    return `@${fallbackSlug}`;
  }
}

export function getChannelAccent(slug: string | null | undefined) {
  return CHANNEL_STYLES[slug ?? ""]?.avatar ?? "bg-[#A8A59C] text-white";
}

export function getChannelHeaderTone(slug: string | null | undefined) {
  return CHANNEL_STYLES[slug ?? ""]?.header ?? "bg-[#2C2C28]";
}

export function getChannelInitials(name: string | null | undefined) {
  return initialsFromName(name);
}

export function getDefaultSearchPrompt(slug: string, channelName: string) {
  return SEARCH_PROMPTS[slug] ?? `What has ${channelName.split(" ")[0] ?? channelName} said about this topic?`;
}

export function getVideoThumbnailUrl(youtubeId: string) {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function prettifyChannelSlug(slug: string | null | undefined) {
  if (!slug) return "Channel";
  return slug
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
