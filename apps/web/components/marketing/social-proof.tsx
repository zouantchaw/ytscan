function ProofAvatar({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex size-7 items-center justify-center rounded-full border-2 border-background text-[11px] font-semibold text-white ${className}`}
    >
      {label}
    </span>
  );
}

export function SocialProof() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <div className="flex">
        <ProofAvatar label="CS" className="bg-[#1f3d5b]" />
        <ProofAvatar label="JH" className="-ml-2 bg-[#4a9b6e]" />
        <ProofAvatar label="AI" className="-ml-2 bg-[#e34234]" />
      </div>
      <p>Trusted by 2,400+ creators and content teams</p>
    </div>
  );
}
