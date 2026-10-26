import Link from "next/link";

const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/receipts", label: "Receipts" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/export", label: "Export" },
] as const;

export type AdminSection = (typeof SECTIONS)[number]["href"];

/** The Admin area's own tabs, under the main navigation. */
export function AdminNav({ current }: { current: AdminSection }) {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-2 text-sm">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.href === current ? "page" : undefined}
          className={
            s.href === current
              ? "rounded-full bg-pink-600 px-3 py-1 font-medium text-white"
              : "rounded-full border border-pink-200 px-3 py-1 font-medium text-pink-800 hover:border-pink-400 dark:border-pink-900 dark:text-pink-200"
          }
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

export const cardClass = "rounded-xl border border-pink-200 bg-white dark:border-pink-900 dark:bg-zinc-900";
export const thClass = "px-4 py-2 font-medium";
export const tdClass = "px-4 py-2";
export const mutedClass = "text-pink-800/70 dark:text-pink-200/70";

export function when(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}
