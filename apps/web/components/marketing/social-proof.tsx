function ProofAvatar({ className }: { className: string }) {
  return (
    <span
      className={`inline-flex size-7 rounded-full border-2 border-background ${className}`}
    />
  );
}

export function SocialProof() {
  return (
    <div className="flex items-center gap-6 pt-2 text-[13px] text-[#9b9b96]">
      <div className="flex">
        <ProofAvatar className="bg-[#d4d0c8]" />
        <ProofAvatar className="-ml-2 bg-[#c4bfb6]" />
        <ProofAvatar className="-ml-2 bg-[#b4afa6]" />
      </div>
      <p>Trusted by 2,400+ creators and content teams</p>
    </div>
  );
}
