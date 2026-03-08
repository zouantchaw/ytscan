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
    <aside className="flex min-h-[320px] flex-col justify-between bg-[#1A1A18] px-8 py-10 text-white md:min-h-screen md:px-10 md:py-10 xl:px-12 xl:py-12">
      <AppLogo inverted size="md" />
      <div className="max-w-md space-y-4">
        <h1 className="max-w-md whitespace-pre-line text-[34px] font-semibold leading-[1.16] tracking-[-0.03em] text-balance md:text-[36px] md:leading-[42px]">
          {title}
        </h1>
        <p className="max-w-md text-[15px] leading-6 text-white/50 md:text-[15px]">
          {description}
        </p>
      </div>
      <p className="text-[13px] text-[#6b6b66]">ytscan.com</p>
    </aside>
  );
}
