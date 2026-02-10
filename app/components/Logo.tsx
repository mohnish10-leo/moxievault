"use client";

export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="ember-gradient rounded-xl flex items-center justify-center ring-1 ring-white/10"
        style={{ width: size, height: size }}
      >
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 30c0-8 6-16 16-18 6-1 12 1 17 6-4-1-7 0-9 3 4 2 6 5 6 8 0 6-6 11-14 11-8 0-16-4-16-10Z"
            fill="#1b1406"
          />
          <path
            d="M14 26c2-4 6-7 11-8-2 2-3 4-2 7 2-1 4-1 6 0-2 3-6 6-11 6-3 0-4-2-4-5Z"
            fill="#2a1d0a"
          />
          <path
            d="M28 17c2-1 5-1 7 0-1-2-3-4-6-5-2-1-3 0-4 1 1 1 2 2 3 4Z"
            fill="#2a1d0a"
          />
          <path
            d="M32 24c1 0 2 1 2 2 0 1-1 2-2 2s-2-1-2-2c0-1 1-2 2-2Z"
            fill="#ffd38b"
          />
        </svg>
      </div>
      <div className="text-display text-sm sm:text-base tracking-wide text-white">
        MoxieVault
      </div>
    </div>
  );
}
