import Link from "next/link";
import { LogoutButton } from "@/app/logout-button";

const link = "text-sm font-medium text-pink-800 hover:text-pink-950 dark:text-pink-200 dark:hover:text-white";

export function AppNav({ user }: { user: { name: string; role: "ADMIN" | "USER" } }) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-pink-100 pb-4 dark:border-pink-950">
      <div className="flex flex-wrap items-center gap-5">
        <Link href="/dashboard" className="flex items-center gap-1 font-semibold text-pink-900 dark:text-pink-100">
          <span aria-hidden>🐷</span> Kumbara
        </Link>
        <Link href="/transactions" className={link}>
          Transactions
        </Link>
        <Link href="/accounts" className={link}>
          Accounts
        </Link>
        {user.role === "ADMIN" && (
          <Link href="/admin" className={link}>
            Admin
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-pink-800/70 dark:text-pink-200/70">
          {user.name}
          {user.role === "ADMIN" ? " · Admin" : ""}
        </span>
        <LogoutButton />
      </div>
    </nav>
  );
}
