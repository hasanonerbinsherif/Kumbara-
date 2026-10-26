import Link from "next/link";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { listUsers } from "@/lib/users";
import { AdminNav, cardClass, mutedClass, tdClass, thClass, when } from "../admin-nav";
import { AddUserForm, UserRowActions } from "./user-forms";

export const metadata = { title: "Users · Admin · Kumbara" };

async function Users() {
  const admin = await requireAdmin();
  const users = await listUsers(db);

  return (
    <>
      <AppNav user={admin} />
      <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Users</h1>
      <AdminNav current="/admin/users" />
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-pink-900 dark:text-pink-100">Add someone</h2>
        <p className={`text-sm ${mutedClass}`}>There is no sign-up page: only an Admin can add people.</p>
        <AddUserForm />
      </section>
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className={mutedClass}>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Role</th>
              <th className={`${thClass} text-right`}>Accounts</th>
              <th className={`${thClass} text-right`}>Transactions</th>
              <th className={thClass}>Last login (UTC)</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody className="text-zinc-900 dark:text-zinc-100">
            {users.map((u) => (
              <tr key={u.id} className="border-t border-pink-100 align-top dark:border-pink-950">
                <td className={tdClass}>
                  <div className="font-medium">{u.name}</div>
                  <div className={`text-xs ${mutedClass}`}>{u.email}</div>
                </td>
                <td className={tdClass}>{u.role === "ADMIN" ? "Admin" : "User"}</td>
                <td className={`${tdClass} text-right`}>{u._count.accounts}</td>
                <td className={`${tdClass} text-right`}>
                  {u._count.transactions > 0 ? (
                    <Link
                      href={`/transactions?userId=${u.id}`}
                      className="underline decoration-pink-300 underline-offset-2"
                    >
                      {u._count.transactions}
                    </Link>
                  ) : (
                    0
                  )}
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {u.lastLoginAt ? when(u.lastLoginAt) : <span className={mutedClass}>Never</span>}
                </td>
                <td className={tdClass}>
                  <UserRowActions userId={u.id} name={u.name} role={u.role} isSelf={u.id === admin.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function UsersPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Users />
      </Suspense>
    </main>
  );
}
