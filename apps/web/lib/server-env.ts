const DEFAULT_API_ORIGIN = "https://ytscan-api.wiel.workers.dev";

export function getApiOrigin() {
  return (
    process.env.YTSCAN_API_ORIGIN?.replace(/\/+$/, "") ?? DEFAULT_API_ORIGIN
  );
}
