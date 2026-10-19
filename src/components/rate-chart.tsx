"use client";

import { useEffect, useId, useRef, useState } from "react";

type Point = { date: string; rate: number };

const H = 220;
const PAD = { top: 12, right: 16, bottom: 28, left: 56 };

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || Math.abs(max) || 1;
  const step = 10 ** Math.floor(Math.log10(span / count));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => span / s <= count) ?? step * 10;
  const ticks = [];
  for (let t = Math.floor(min / nice) * nice; t <= max + nice / 2; t += nice) ticks.push(Number(t.toPrecision(12)));
  return ticks;
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 5 });
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** A line of the from→to rate over time, with a hover crosshair and a table view. */
export function RateChart({ points, from, to }: { points: Point[]; from: string; to: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();
  // Draw at the container's real width so labels stay readable on a phone.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [points.length]);
  if (points.length < 2) return null;

  const rates = points.map((p) => p.rate);
  const ticks = niceTicks(Math.min(...rates), Math.max(...rates));
  const [lo, hi] = [ticks[0], ticks[ticks.length - 1]];
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`).join("");
  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * (W - PAD.left - PAD.right);
    setHover(
      Math.max(0, Math.min(points.length - 1, Math.round((px / (W - PAD.left - PAD.right)) * (points.length - 1)))),
    );
  }

  const h = hover === null ? null : points[hover];
  return (
    <figure className="flex flex-col gap-2">
      <figcaption id={titleId} className="text-sm text-pink-800/70 dark:text-pink-200/70">
        1 {from} in {to}, {shortDate(points[0].date)} to {shortDate(points[points.length - 1].date)}
      </figcaption>
      <div ref={box} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={titleId}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-pink-100 dark:stroke-pink-950"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-pink-800/70 text-[11px] dark:fill-pink-200/70"
              >
                {fmt(t)}
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="fill-pink-800/70 text-[11px] dark:fill-pink-200/70"
            >
              {shortDate(points[i].date)}
            </text>
          ))}
          <path
            d={path}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-pink-600 dark:stroke-pink-400"
          />
          {h && hover !== null && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                className="stroke-pink-300 dark:stroke-pink-800"
                strokeWidth={1}
              />
              <circle
                cx={x(hover)}
                cy={y(h.rate)}
                r={4}
                strokeWidth={2}
                className="fill-pink-600 stroke-white dark:fill-pink-400 dark:stroke-zinc-900"
              />
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={W - PAD.left - PAD.right}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 rounded-md border border-pink-200 bg-white px-2 py-1 text-xs whitespace-nowrap text-zinc-900 shadow-sm dark:border-pink-900 dark:bg-zinc-900 dark:text-zinc-100"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${hover > points.length / 2 ? "calc(-100% - 8px)" : "8px"})`,
            }}
          >
            <span className="text-pink-800/70 dark:text-pink-200/70">{shortDate(h.date)}</span> 1 {from} = {fmt(h.rate)}{" "}
            {to}
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-pink-700 dark:text-pink-300">Show as a table</summary>
        <div className="mt-2 max-h-60 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="text-pink-800/70 dark:text-pink-200/70">
              <tr>
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 text-right font-medium">
                  1 {from} in {to}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-pink-100 dark:border-pink-950">
                  <td className="py-1">{p.date}</td>
                  <td className="py-1 text-right tabular-nums">{fmt(p.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
