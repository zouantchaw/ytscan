import Link from "next/link";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "#docs", label: "Docs" },
];

export function LandingNav() {
  return (
    <header className="bg-background">
      <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between gap-6 px-6 md:px-10 xl:px-16">
        <AppLogo size="sm" />
        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[15px] leading-[18px] text-[#6b6b66] hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Button asChild variant="dark" size="sm" className="h-10 rounded-[8px] px-5 text-[14px] font-semibold">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </nav>
        <Button asChild variant="dark" size="sm" className="h-10 rounded-[8px] px-5 text-[14px] font-semibold md:hidden">
          <Link href="/sign-in">Sign In</Link>
        </Button>
      </div>
    </header>
  );
}
