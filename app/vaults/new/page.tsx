"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "../../components/Logo";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function NewVaultPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session) {
        router.replace("/auth");
        return;
      }
      setOwnerId(session.user.id);
    });
  }, [router, supabase]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!ownerId) {
      setMessage("You must be signed in.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("vaults")
      .insert({
        owner_id: ownerId,
        name: name.trim(),
        description: description.trim() || null,
        is_public: isPublic,
        allow_downloads: allowDownloads,
      })
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data?.id) {
      router.replace(`/vaults/${data.id}`);
      return;
    }

    setMessage("Vault created, but no ID returned.");
    setLoading(false);
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="vault-card vault-shadow rounded-2xl p-6 sm:p-8 fade-up">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Logo />
            <a href="/vaults" className="text-xs text-white/70 hover:text-white">
              Back to vaults
            </a>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div>
              <h1 className="text-display text-2xl sm:text-3xl">
                Create a new vault
              </h1>
              <p className="mt-3 text-sm text-white/70">
                Vault names are public and unique. Pick a name you want people
                to find if you enable public access.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-white/60">Vault name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/40"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/40"
                />
              </div>
              <div className="flex flex-col gap-3 text-sm text-white/75">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/40"
                  />
                  Make this vault public (searchable by name)
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allowDownloads}
                    onChange={(event) => setAllowDownloads(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/40"
                  />
                  Allow downloads for public viewers
                </label>
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
                {loading ? "Creating..." : "Create vault"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
