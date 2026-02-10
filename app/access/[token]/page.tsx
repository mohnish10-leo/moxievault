"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Logo from "../../components/Logo";
import PreviewModal from "../../components/PreviewModal";

type Vault = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  allow_downloads: boolean;
  created_at: string;
};

type VaultFile = {
  id: string;
  original_name: string | null;
  size_bytes: number;
  sort_index: number;
  created_at: string;
};

export default function AccessVaultPage() {
  const params = useParams<{ token: string }>();
  const [vault, setVault] = useState<Vault | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);

  const totalBytes = useMemo(
    () => files.reduce((acc, file) => acc + (file.size_bytes || 0), 0),
    [files]
  );

  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/vault-by-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data?.error || "Access denied.");
        setLoading(false);
        return;
      }

      setVault(data.vault);
      setFiles(data.files || []);
      setLoading(false);
    };

    load();
  }, [params.token]);

  const handleView = async (fileId: string) => {
    setMessage(null);
    const response = await fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vaultFileId: fileId,
        shareToken: params.token,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data?.error || "View failed.");
      return;
    }

    setPreviewUrl(data.signedUrl);
    setPreviewTitle(data.originalName || "Preview");
  };

  const handleDownload = async (fileId: string) => {
    setMessage(null);
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vaultFileId: fileId,
        shareToken: params.token,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data?.error || "Download failed.");
      return;
    }

    try {
      const res = await fetch(data.signedUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.originalName || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage("Download failed.");
    }
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

          {loading && <div className="mt-6 text-sm text-white/60">Loading...</div>}

          {!loading && !vault && (
            <div className="mt-6 text-sm text-white/60">
              Vault not found or access denied.
            </div>
          )}

          {vault && (
            <div className="mt-6 space-y-4">
              <div className="text-display text-2xl sm:text-3xl">
                {vault.name}
              </div>
              {vault.description && (
                <div className="text-sm text-white/70">{vault.description}</div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-white/60">
                <span>{vault.is_public ? "Public" : "Private"}</span>
                <span>
                  Downloads: {vault.allow_downloads ? "Enabled" : "Disabled"}
                </span>
                <span>Created: {new Date(vault.created_at).toLocaleDateString()}</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
                Total storage used: {totalMb} MB
              </div>

              {message && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                  {message}
                </div>
              )}

              <div className="grid gap-3">
                {files.length === 0 && (
                  <div className="text-xs text-white/60">No files yet.</div>
                )}
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm text-white/90">
                        {file.original_name ?? "Untitled"}
                      </div>
                      <div className="text-xs text-white/50">
                        {(file.size_bytes / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleView(file.id)}
                        className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/40"
                      >
                        View
                      </button>
                      {vault.allow_downloads && (
                        <button
                          onClick={() => handleDownload(file.id)}
                          className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/40"
                        >
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <PreviewModal
        open={Boolean(previewUrl)}
        title={previewTitle}
        url={previewUrl}
        onClose={() => setPreviewUrl(null)}
      />
    </main>
  );
}
