"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/channels");
  }, [router]);

  return null;
}
