import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  href?: string;
  inverted?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: {
    mark: 28,
    text: "text-[22px] leading-none",
  },
  md: {
    mark: 36,
    text: "text-[26px] leading-none",
  },
  lg: {
    mark: 40,
    text: "text-[30px] leading-none",
  },
};

export function AppLogo({
  className,
  href = "/",
  inverted = false,
  size = "md",
}: AppLogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={sizeMap[size].mark} />
      <span
        className={cn(
          "font-display font-bold tracking-[-0.02em]",
          sizeMap[size].text,
          inverted ? "text-white" : "text-foreground"
        )}
      >
        YTScan
      </span>
    </span>
  );

  return (
    <Link href={href} className="inline-flex items-center">
      {content}
    </Link>
  );
}
