"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const URL_ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed: "The sign-in link failed. Please try again.",
  otp_expired: "The confirmation link expired. Please register again.",
  access_denied: "Access denied. The link may have already been used.",
};

// Isolated so useSearchParams is inside a Suspense boundary
function UrlErrorReader({
  onError,
}: {
  onError: (msg: string) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const urlError =
      searchParams.get("error") ??
      new URLSearchParams(window.location.hash.slice(1)).get("error_code");
    if (urlError) {
      onError(
        URL_ERROR_MESSAGES[urlError] ??
          searchParams.get("error_description") ??
          "Authentication error. Please try again.",
      );
    }
  }, [searchParams, onError]);
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/decks");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <Suspense>
        <UrlErrorReader onError={setError} />
      </Suspense>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-amber-400 mb-1">
          MTGA Deck Builder
        </h1>
        <p className="text-gray-400 text-sm">Sign in to manage your decks</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-5">Sign in</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm text-gray-400 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm text-gray-400 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-semibold rounded-lg transition-colors text-sm"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600">or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <button
          disabled
          title="Google sign-in coming soon"
          className="w-full py-2 px-4 bg-gray-800 border border-gray-700 rounded-lg text-gray-500 text-sm cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
            />
          </svg>
          Continue with Google (coming soon)
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          No account?{" "}
          <Link
            href="/register"
            className="text-amber-400 hover:text-amber-300"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
