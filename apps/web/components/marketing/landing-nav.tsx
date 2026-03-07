import Link from "next/link";
import { AppLogo } from "@/components/brand/app-logo";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#docs", label: "Docs" },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-transparent bg-background/90 backdrop-blur-sm">
      <div className="container-page flex h-[86px] items-center justify-between gap-6">
        <AppLogo size="sm" />
        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Button asChild variant="outline" size="sm">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </nav>
        <Button asChild variant="outline" size="sm" className="md:hidden">
          <Link href="/sign-in">Sign In</Link>
        </Button>
      </div>
    </header>
  );
}
