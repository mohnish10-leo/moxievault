import Logo from "./components/Logo";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-12 lg:py-20">
      <div className="mx-auto max-w-6xl grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
        <div className="fade-up">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/80">
              Private vaults. Public discovery.
            </div>
          </div>
          <h1 className="text-display text-4xl sm:text-5xl lg:text-6xl mt-6">
            MoxieVault is the secure home for your most important files.
          </h1>
          <p className="text-white/75 mt-4 text-base sm:text-lg">
            Create a vault, upload PDFs and documents, and control every access
            point. Public vaults are searchable by name, private vaults require
            an access token, and every file is delivered via signed URLs.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/auth"
              className="ember-gradient rounded-lg px-6 py-3 text-sm font-semibold"
            >
              Create a Vault
            </a>
            <a
              href="/vaults"
              className="rounded-lg border border-white/20 px-6 py-3 text-sm text-white/90 hover:border-white/40"
            >
              Your Vaults
            </a>
            <a
              href="/discover"
              className="rounded-lg border border-white/10 px-6 py-3 text-sm text-white/70 hover:border-white/30"
            >
              Search Vaults
            </a>
          </div>

          <div className="mt-6 text-xs text-white/60">
            30 MB per vault - Signed URLs - Private storage
          </div>
        </div>

        <div className="relative fade-up">
          <div className="absolute -top-12 -left-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-10 right-0 h-32 w-32 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="vault-card vault-shadow rounded-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/50">
              <span>Vault Overview</span>
              <span className="text-emerald-300">Public</span>
            </div>
            <div className="mt-4 text-lg font-semibold text-white">
              Investor Due Diligence
            </div>
            <div className="mt-4 grid gap-3 text-sm text-white/80">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Files</span>
                <span>9 PDFs</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Storage Used</span>
                <span>18.4 MB / 30 MB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Share Link</span>
                <span className="text-white/90">Signed and stable</span>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/65">
              Only the owner can add, delete, or reorder files. Viewers can only
              read and download if permission is enabled.
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl mt-16 grid gap-6 lg:grid-cols-3">
        {[
          {
            title: "Zero-trust vault access",
            text: "Files live in a private bucket. Access is granted only through signed URLs after permission checks.",
          },
          {
            title: "Public discovery, private control",
            text: "Public vaults are searchable by name. Private vaults require an access token from the owner.",
          },
          {
            title: "Owner-only management",
            text: "Only the vault owner can add, delete, or rearrange files, even when the vault is public.",
          },
        ].map((item) => (
          <div key={item.title} className="vault-card rounded-2xl p-6 fade-up">
            <div className="text-display text-lg">{item.title}</div>
            <div className="mt-3 text-sm text-white/70">{item.text}</div>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-6xl mt-16 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] items-center">
        <div className="vault-card rounded-2xl p-6 sm:p-8 fade-up">
          <div className="text-xs uppercase tracking-widest text-white/50">
            How it works
          </div>
          <div className="mt-5 grid gap-4 text-sm text-white/75">
            <div>
              <div className="text-white/90 font-semibold">1. Sign in</div>
              <div className="mt-1 text-white/70">
                Email and password only. No social providers required.
              </div>
            </div>
            <div>
              <div className="text-white/90 font-semibold">2. Create a vault</div>
              <div className="mt-1 text-white/70">
                Choose a unique name, set privacy, and enable downloads if
                needed.
              </div>
            </div>
            <div>
              <div className="text-white/90 font-semibold">3. Upload and share</div>
              <div className="mt-1 text-white/70">
                Add files up to 30 MB total, reorder anytime, and share via one
                stable link.
              </div>
            </div>
          </div>
        </div>

        <div className="relative fade-up">
          <div className="vault-card rounded-2xl p-6 sm:p-8">
            <div className="text-display text-2xl sm:text-3xl">
              Built for high-stakes files.
            </div>
            <div className="mt-4 text-white/75">
              MoxieVault blends premium UI with rigorous access control. Every
              vault is tracked, shareable, and searchable on your terms.
            </div>
            <div className="mt-6 grid gap-3 text-sm text-white/75">
              <div className="flex items-center justify-between">
                <span>Access tokens</span>
                <span className="text-white/90">1 per vault</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Public vault lookup</span>
                <span className="text-white/90">By name</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Signed URLs</span>
                <span className="text-white/90">Owner or token</span>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/auth"
                className="ember-gradient rounded-lg px-5 py-2 text-sm font-semibold"
              >
                Start free
              </a>
              <a
                href="/vaults"
                className="rounded-lg border border-white/15 px-5 py-2 text-sm text-white/80 hover:border-white/40"
              >
                View vaults
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
