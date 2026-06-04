"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface NavBarAuthButtonProps {
  user: User | null;
}

export function NavBarAuthButton({ user }: NavBarAuthButtonProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="px-3 py-1.5 rounded-md text-sm bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold transition-colors"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 hidden sm:block truncate max-w-[160px]">
        {user.email}
      </span>
      <button
        onClick={handleSignOut}
        className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
