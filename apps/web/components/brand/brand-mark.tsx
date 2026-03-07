import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  size?: number;
};

export function BrandMark({ className, size = 36 }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 36 36"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="36" height="36" rx="8" fill="#E34234" />
      <path d="M10 13L16 18L10 23V13Z" fill="white" />
      <rect x="18" y="12" width="9" height="2.5" rx="1.25" fill="white" fillOpacity="0.8" />
      <rect x="18" y="16" width="6" height="2.5" rx="1.25" fill="white" fillOpacity="0.5" />
      <rect x="18" y="20" width="7.5" height="2.5" rx="1.25" fill="white" fillOpacity="0.3" />
    </svg>
  );
}
