"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Supabase sometimes redirects auth errors to the site root with params in the
// URL hash. This component detects that and forwards to /login so the user
// sees a readable error message.
export function AuthErrorRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("error=")) return;

    const params = new URLSearchParams(hash.slice(1));
    const errorCode = params.get("error_code") ?? params.get("error");
    if (errorCode) {
      router.replace(`/login?error=${encodeURIComponent(errorCode)}`);
    }
  }, [router]);

  return null;
}
