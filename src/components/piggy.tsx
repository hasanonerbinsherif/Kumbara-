/**
 * A piggy bank that fills up with the share of money you've kept.
 * Pure SVG + CSS, so it renders on the server and animates without JavaScript.
 */
export function Piggy({ fill, label }: { fill: number; label: string }) {
  const level = Math.min(1, Math.max(0, fill));
  // The body spans y = 30..130; the fill rises from the bottom.
  const top = 130 - level * 100;
  return (
    <svg viewBox="0 0 200 160" role="img" aria-label={label} className="h-auto w-40 shrink-0 sm:w-48">
      <defs>
        <clipPath id="piggy-body">
          <ellipse cx="96" cy="80" rx="70" ry="50" />
          <circle cx="160" cy="76" r="22" />
        </clipPath>
      </defs>
      {/* legs */}
      <g className="fill-pink-300 dark:fill-pink-800">
        <rect x="46" y="116" width="18" height="26" rx="6" />
        <rect x="118" y="116" width="18" height="26" rx="6" />
      </g>
      {/* ear */}
      <path d="M138 38 L152 14 L162 44 Z" className="fill-pink-300 dark:fill-pink-800" />
      {/* body background */}
      <g clipPath="url(#piggy-body)">
        <rect x="0" y="0" width="200" height="160" className="fill-pink-100 dark:fill-pink-950" />
        <rect x="0" y={top} width="200" height={160 - top} className="piggy-fill fill-pink-400 dark:fill-pink-600" />
      </g>
      {/* outline */}
      <g className="fill-none stroke-pink-700 dark:stroke-pink-300" strokeWidth="4">
        <ellipse cx="96" cy="80" rx="70" ry="50" />
        <path d="M26 72 q-14 -6 -10 -18" strokeLinecap="round" />
      </g>
      {/* snout */}
      <ellipse
        cx="174"
        cy="80"
        rx="14"
        ry="11"
        className="fill-pink-300 stroke-pink-700 dark:fill-pink-800 dark:stroke-pink-300"
        strokeWidth="3"
      />
      <circle cx="170" cy="80" r="2.5" className="fill-pink-800 dark:fill-pink-200" />
      <circle cx="178" cy="80" r="2.5" className="fill-pink-800 dark:fill-pink-200" />
      {/* eye and coin slot */}
      <circle cx="150" cy="60" r="4" className="fill-zinc-900 dark:fill-zinc-100" />
      <rect x="80" y="26" width="32" height="7" rx="3.5" className="fill-pink-800 dark:fill-pink-200" />
    </svg>
  );
}

/** A few coins dropping into a slot, played once after money comes in. */
export function CoinDrop({ symbol }: { symbol: string }) {
  return (
    <div aria-hidden className="pointer-events-none relative h-12 w-20 shrink-0 overflow-hidden">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="coin absolute top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-600 bg-amber-300 text-[10px] font-bold text-amber-800"
          style={{ left: `${8 + i * 20}px`, animationDelay: `${i * 180}ms` }}
        >
          {symbol}
        </span>
      ))}
      <span className="absolute inset-x-1 bottom-1 h-1.5 rounded-full bg-pink-800 dark:bg-pink-200" />
    </div>
  );
}
