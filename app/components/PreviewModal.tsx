"use client";

type PreviewModalProps = {
  open: boolean;
  title?: string | null;
  url?: string | null;
  onClose: () => void;
};

export default function PreviewModal({ open, title, url, onClose }: PreviewModalProps) {
  if (!open || !url) return null;

  const isPdf = url.toLowerCase().includes(".pdf") || url.includes("application/pdf");
  const isImage =
    url.toLowerCase().includes(".png") ||
    url.toLowerCase().includes(".jpg") ||
    url.toLowerCase().includes(".jpeg") ||
    url.toLowerCase().includes(".webp");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b1117]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm text-white/80">{title || "Preview"}</div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/40"
          >
            Close
          </button>
        </div>
        <div className="h-[70vh] w-full bg-black/40">
          {isPdf && (
            <iframe title="Preview" src={url} className="h-full w-full" />
          )}
          {isImage && (
            <img
              src={url}
              alt={title || "Preview"}
              className="h-full w-full object-contain"
            />
          )}
          {!isPdf && !isImage && (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
              Preview not available for this file type.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
