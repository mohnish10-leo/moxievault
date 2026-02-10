"use client";

import { useEffect, useState } from "react";
import Logo from "../components/Logo";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type VaultResult = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
};

export default function DiscoverPage() {
  const supabase = createSupabaseBrowser();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VaultResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");

  const runSearch = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.rpc("search_vaults_by_name_all", {
      p_name_fragment: trimmed,
      p_limit: 20,
    });

    if (error) {
      console.error("SEARCH ERROR:", error);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setResults((data as VaultResult[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      runSearch(query);
    }, 300);
    return () => clearTimeout(delay);
  }, [query]);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="vault-card vault-shadow rounded-2xl p-6 sm:p-8 fade-up">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Logo />
            <a href="/" className="text-xs text-white/70 hover:text-white">
              Back to home
            </a>
          </div>

          <div className="mt-6">
            <div className="text-display text-2xl sm:text-3xl">
              Discover vaults
            </div>
            <p className="mt-2 text-sm text-white/70">
              Search by vault name. Results update as you type.
            </p>
          </div>

          <div className="mt-6">
            <input
              type="text"
              placeholder="Search vault name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/40"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Enter access token for private vault"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/40"
            />
            <button
              type="button"
              disabled={!tokenInput.trim()}
              onClick={() => {
                if (tokenInput.trim()) {
                  window.location.href = `/access/${encodeURIComponent(tokenInput.trim())}`;
                }
              }}
              className="rounded-lg border border-white/20 px-4 py-2 text-xs text-white/80 hover:border-white/40 disabled:opacity-50"
            >
              Open with token
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              {message}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {loading && (
              <div className="text-sm text-white/60">Searching...</div>
            )}
            {!loading && results.length === 0 && query.trim() && (
              <div className="text-sm text-white/60">No matches found.</div>
            )}
            {results.map((vault) => (
              <div
                key={vault.id}
                className="vault-card rounded-2xl p-5 transition hover:border-white/30"
              >
                <div className="text-xs text-white/60">
                  {vault.is_public ? "Public vault" : "Private vault"}
                </div>
                <div className="mt-2 text-lg text-white">{vault.name}</div>
                {vault.description && (
                  <div className="mt-2 text-xs text-white/65">
                    {vault.description}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {vault.is_public ? (
                    <a
                      href={`/public/name/${encodeURIComponent(vault.name)}`}
                      className="rounded-lg border border-white/20 px-3 py-1 text-white/80 hover:border-white/40"
                    >
                      Open vault
                    </a>
                  ) : (
                    <div className="rounded-lg border border-white/10 px-3 py-1 text-white/60">
                      Token required
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
