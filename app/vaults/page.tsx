"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "../components/Logo";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type Vault = {
  id: string;
  name: string;
  is_public: boolean;
  allow_downloads: boolean;
  created_at: string;
};

export default function VaultsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.replace("/auth");
        return;
      }
      setUserEmail(session.session.user.email ?? null);

      const { data, error } = await supabase
        .from("vaults")
        .select("id, name, is_public, allow_downloads, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("VAULTS FETCH ERROR:", error);
      }
      setVaults(data ?? []);
      setLoading(false);
    };

    load();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="vault-card vault-shadow rounded-2xl p-6 sm:p-8 fade-up">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Logo />
            <div className="flex items-center gap-4 text-xs text-white/70">
              {userEmail && <span>{userEmail}</span>}
              <button onClick={handleSignOut} className="hover:text-white">
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-display text-2xl sm:text-3xl">Your vaults</div>
              <div className="mt-2 text-sm text-white/70">
                Create, manage, and share your secured collections.
              </div>
            </div>
            <a
              href="/vaults/new"
              className="rounded-lg ember-gradient px-4 py-2 text-sm font-semibold"
            >
              Create vault
            </a>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {loading && (
              <div className="text-sm text-white/60">Loading vaults...</div>
            )}
            {!loading && vaults.length === 0 && (
              <div className="text-sm text-white/60">
                No vaults yet. Create your first vault.
              </div>
            )}
            {vaults.map((vault) => (
              <a
                key={vault.id}
                href={`/vaults/${vault.id}`}
                className="vault-card rounded-2xl p-5 hover:border-white/30 transition"
              >
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>{vault.is_public ? "Public" : "Private"}</span>
                  <span>{new Date(vault.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-3 text-lg text-white">{vault.name}</div>
                <div className="mt-2 text-xs text-white/60">
                  Downloads: {vault.allow_downloads ? "Enabled" : "Disabled"}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
