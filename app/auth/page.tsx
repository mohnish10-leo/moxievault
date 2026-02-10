"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "../components/Logo";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/vaults");
      }
    });
  }, [router, supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      email: email.trim(),
      password,
    };

    const response =
      mode === "signin"
        ? await supabase.auth.signInWithPassword(payload)
        : await supabase.auth.signUp(payload);

    if (response.error) {
      setMessage(response.error.message);
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      setMessage("Check your email to confirm your account.");
      setLoading(false);
      return;
    }

    router.replace("/vaults");
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="vault-card vault-shadow rounded-2xl p-6 sm:p-8 fade-up">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Logo />
            <a href="/" className="text-xs text-white/70 hover:text-white">
              Back to home
            </a>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div>
              <h1 className="text-display text-2xl sm:text-3xl">
                {mode === "signin" ? "Sign in to MoxieVault" : "Create your account"}
              </h1>
              <p className="mt-3 text-sm text-white/70">
                Email + password only. No social providers required.
              </p>

              <div className="mt-5 inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`rounded-full px-3 py-1 ${
                    mode === "signin" ? "bg-white/15 text-white" : "text-white/70"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`rounded-full px-3 py-1 ${
                    mode === "signup" ? "bg-white/15 text-white" : "text-white/70"
                  }`}
                >
                  Sign up
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-white/60">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/40"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/40"
                />
              </div>

              {message && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg ember-gradient px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {loading
                  ? "Working..."
                  : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
