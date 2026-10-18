import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";

export const metadata = { title: "Admin · Kumbara" };

async function Users() {
  const admin = await requireAdmin();
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return (
    <>
      <AppNav user={admin} />
      <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Admin: users</h1>
      <table className="w-full text-left text-sm">
        <thead className="text-pink-800/70 dark:text-pink-200/70">
          <tr>
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Email</th>
            <th className="py-2 font-medium">Role</th>
            <th className="py-2 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody className="text-zinc-900 dark:text-zinc-100">
          {users.map((u) => (
            <tr key={u.id} className="border-t border-pink-100 dark:border-pink-950">
              <td className="py-2">{u.name}</td>
              <td className="py-2">{u.email}</td>
              <td className="py-2">{u.role === "ADMIN" ? "Admin" : "User"}</td>
              <td className="py-2">{u.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Users />
      </Suspense>
    </main>
  );
}
