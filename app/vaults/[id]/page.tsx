"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Logo from "../../components/Logo";
import PreviewModal from "../../components/PreviewModal";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type Vault = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  allow_downloads: boolean;
  share_token: string | null;
  created_at: string;
};

type VaultFile = {
  id: string;
  original_name: string | null;
  size_bytes: number;
  sort_index: number;
  created_at: string;
  storage_path: string;
  deleted_at?: string | null;
};

export default function VaultDetailPage() {
  const params = useParams<{ id: string }>();
  const supabase = createSupabaseBrowser();
  const [vault, setVault] = useState<Vault | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const totalBytes = useMemo(
    () => files.reduce((acc, file) => acc + (file.size_bytes || 0), 0),
    [files]
  );

  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("vaults")
        .select(
          "id, name, description, is_public, allow_downloads, share_token, created_at, owner_id"
        )
        .eq("id", params.id)
        .single();

      if (error) {
        console.error("VAULT FETCH ERROR:", error);
      }

      if (data) {
        setVault({
          id: data.id,
          name: data.name,
          description: data.description,
          is_public: data.is_public,
          allow_downloads: data.allow_downloads,
          share_token: data.share_token,
          created_at: data.created_at,
        });
        setIsOwner(session.session?.user.id === data.owner_id);
      }

      if (data) {
        const { data: filesData, error: filesError } = await supabase
          .from("vault_files")
          .select(
            "id, original_name, size_bytes, sort_index, created_at, storage_path, deleted_at"
          )
          .eq("vault_id", data.id)
          .is("deleted_at", null)
          .order("sort_index", { ascending: true })
          .order("created_at", { ascending: true });

        if (filesError) {
          console.error("FILES FETCH ERROR:", filesError);
        } else {
          setFiles(filesData ?? []);
        }
      }

      setLoading(false);
    };

    load();
  }, [params.id, supabase]);

  const refreshFiles = async () => {
    if (!vault) return;
    const { data: filesData, error: filesError } = await supabase
      .from("vault_files")
      .select(
        "id, original_name, size_bytes, sort_index, created_at, storage_path, deleted_at"
      )
      .eq("vault_id", vault.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (filesError) {
      console.error("FILES FETCH ERROR:", filesError);
      setMessage(filesError.message);
      return;
    }
    setFiles(filesData ?? []);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !vault) return;

    setMessage(null);
    setUploading(true);

    const fileSize = file.size;
    if (totalBytes + fileSize > 30 * 1024 * 1024) {
      setMessage("Vault size limit exceeded (30 MB).");
      setUploading(false);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      setMessage("You must be signed in.");
      setUploading(false);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Unsupported file type.");
      setUploading(false);
      return;
    }

    const extension = file.name.split(".").pop() || "bin";
    const safeName = `${crypto.randomUUID()}.${extension}`;
    const storagePath = `${userId}/${vault.id}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("vault-files")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("vault_files").insert({
      vault_id: vault.id,
      owner_id: userId,
      uploaded_by: userId,
      storage_path: storagePath,
      original_name: file.name,
      size_bytes: file.size,
      sort_index: files.length,
    });

    if (insertError) {
      setMessage(insertError.message);
      setUploading(false);
      return;
    }

    await refreshFiles();
    setUploading(false);
  };

  const handleDelete = async (file: VaultFile) => {
    if (!vault) return;
    setMessage(null);

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      setMessage("You must be signed in.");
      return;
    }

    const { error: dbError } = await supabase
      .from("vault_files")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", file.id);

    if (dbError) {
      setMessage(dbError.message);
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("vault-files")
      .remove([file.storage_path]);

    if (storageError) {
      console.error("STORAGE DELETE ERROR:", storageError);
    }

    await refreshFiles();
  };

  const persistOrder = async (nextFiles: VaultFile[]) => {
    setReordering(true);
    const updateResults = await Promise.all(
      nextFiles.map((file, idx) =>
        supabase.from("vault_files").update({ sort_index: idx }).eq("id", file.id)
      )
    );
    const firstError = updateResults.find((r) => r.error)?.error;
    if (firstError) {
      setMessage(firstError.message);
      await refreshFiles();
    }
    setReordering(false);
  };

  const handleMove = async (fileId: string, direction: "up" | "down") => {
    if (reordering) return;
    const index = files.findIndex((f) => f.id === fileId);
    if (index === -1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= files.length) return;

    const updated = [...files];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setFiles(updated);
    await persistOrder(updated);
  };

  const handleDragStart = (fileId: string) => {
    setDraggingId(fileId);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = async (targetId: string) => {
    if (!draggingId || draggingId === targetId || reordering) return;
    const fromIndex = files.findIndex((f) => f.id === draggingId);
    const toIndex = files.findIndex((f) => f.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const updated = [...files];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setFiles(updated);
    setDraggingId(null);
    await persistOrder(updated);
  };

  const handleDownload = async (fileId: string) => {
    setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    const response = await fetch("/api/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        vaultFileId: fileId,
        shareToken: null,
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

  const handleView = async (fileId: string) => {
    setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    const response = await fetch("/api/view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        vaultFileId: fileId,
        shareToken: null,
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

  const handlePrivacyToggle = async (field: "is_public" | "allow_downloads") => {
    if (!vault) return;
    setUpdatingPrivacy(true);
    setMessage(null);

    const nextValue = !vault[field];
    const updatePayload: Record<string, boolean | string> = { [field]: nextValue };
    if (field === "is_public" && nextValue === false) {
      updatePayload.share_token = crypto.randomUUID().replace(/-/g, "");
    }

    const { error } = await supabase
      .from("vaults")
      .update(updatePayload)
      .eq("id", vault.id);

    if (error) {
      setMessage(error.message);
      setUpdatingPrivacy(false);
      return;
    }

    setVault({ ...vault, ...updatePayload });
    setUpdatingPrivacy(false);
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
              {isOwner && (
                <div className="flex flex-wrap gap-3 text-xs text-white/70">
                  <button
                    onClick={() => handlePrivacyToggle("is_public")}
                    disabled={updatingPrivacy}
                    className="rounded-lg border border-white/15 px-3 py-1 hover:border-white/40 disabled:opacity-50"
                  >
                    {vault.is_public ? "Make Private" : "Make Public"}
                  </button>
                  <button
                    onClick={() => handlePrivacyToggle("allow_downloads")}
                    disabled={updatingPrivacy}
                    className="rounded-lg border border-white/10 px-3 py-1 hover:border-white/40 disabled:opacity-50"
                  >
                    {vault.allow_downloads ? "Disable Downloads" : "Enable Downloads"}
                  </button>
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
                Total storage used: {totalMb} MB / 30 MB
              </div>

              {isOwner && !vault.is_public && vault.share_token && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                  Access token: {vault.share_token}
                </div>
              )}

              <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-white/80">Vault files</div>
                  {isOwner && (
                    <label className="text-xs text-white/70">
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={uploading}
                      />
                      <span className="cursor-pointer rounded-lg border border-white/20 px-3 py-1 hover:border-white/40">
                        {uploading ? "Uploading..." : "Upload file"}
                      </span>
                    </label>
                  )}
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
                  {files.map((file, index) => (
                    <div
                      key={file.id}
                      draggable={isOwner}
                      onDragStart={() => handleDragStart(file.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(file.id)}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2 transition ${
                        draggingId === file.id
                          ? "border-white/40 bg-white/10"
                          : "border-white/10 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isOwner && (
                          <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60">
                            ⋮⋮
                          </div>
                        )}
                        <div>
                        <div className="text-sm text-white/90">
                          {file.original_name ?? "Untitled"}
                        </div>
                        <div className="text-xs text-white/50">
                          {(file.size_bytes / (1024 * 1024)).toFixed(2)} MB
                        </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                        <button
                          onClick={() => handleView(file.id)}
                          className="rounded-lg border border-white/10 px-3 py-1 hover:border-white/40"
                        >
                          View
                        </button>
                        {(isOwner || vault.allow_downloads) && (
                          <button
                            onClick={() => handleDownload(file.id)}
                            className="rounded-lg border border-white/10 px-3 py-1 hover:border-white/40"
                          >
                            Download
                          </button>
                        )}
                        {isOwner && (
                          <>
                            <button
                              onClick={() => handleMove(file.id, "up")}
                              disabled={index === 0}
                              className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
                            >
                              Up
                            </button>
                            <button
                              onClick={() => handleMove(file.id, "down")}
                              disabled={index === files.length - 1}
                              className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
                            >
                              Down
                            </button>
                            <button
                              onClick={() => handleDelete(file)}
                              className="rounded-lg border border-red-400/30 px-3 py-1 text-red-200 hover:border-red-400/60"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
