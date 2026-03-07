import { AppLogo } from "@/components/brand/app-logo";

type AuthBrandPanelProps = {
  title: string;
  description: string;
};

export function AuthBrandPanel({
  title,
  description,
}: AuthBrandPanelProps) {
  return (
    <aside className="flex min-h-[320px] flex-col justify-between bg-[#1A1A18] px-8 py-10 text-white md:min-h-screen md:px-12 md:py-12">
      <AppLogo inverted size="sm" />
      <div className="max-w-md space-y-5">
        <h1 className="max-w-md whitespace-pre-line text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-balance md:text-[56px]">
          {title}
        </h1>
        <p className="max-w-md text-[15px] leading-8 text-white/60 md:text-base">
          {description}
        </p>
      </div>
      <p className="text-sm text-white/56">ytscan.com</p>
    </aside>
  );
}
