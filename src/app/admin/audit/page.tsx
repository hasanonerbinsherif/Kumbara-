import Link from "next/link";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { buttonClass, inputClass } from "@/components/form";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, describeChange, listAudit, parseAuditFilters } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { AdminNav, cardClass, mutedClass, tdClass, thClass, when } from "../admin-nav";

export const metadata = { title: "Audit log · Admin · Kumbara" };

/** Where an entry's record can be opened, when it still has a page of its own. */
function entityHref(entity: string, entityId: string, after: unknown, before: unknown) {
  if (entity === "Transaction") return `/transactions/${entityId}`;
  const data = (after ?? before) as { transactionId?: unknown } | null;
  if (entity === "Receipt" && typeof data?.transactionId === "string") return `/transactions/${data.transactionId}`;
  return null;
}

async function Audit({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  const admin = await requireAdmin();
  const filters = parseAuditFilters(await searchParams);
  const [{ entries, total, pages }, people] = await Promise.all([
    listAudit(db, filters),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pageHref = (page: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, page })) if (v) q.set(k, String(v));
    return `/admin/audit?${q}`;
  };

  return (
    <>
      <AppNav user={admin} />
      <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Audit log</h1>
      <AdminNav current="/admin/audit" />
      <p className={`text-sm ${mutedClass}`}>
        Every login, and every account, transaction, receipt and user change, with who did it. Entries can&apos;t be
        edited or deleted from the app.
      </p>
      <form className={`${cardClass} grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4`}>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Who
          <select name="actorId" defaultValue={filters.actorId ?? ""} className={inputClass}>
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Action
          <select name="action" defaultValue={filters.action ?? ""} className={inputClass}>
            <option value="">Any</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.charAt(0) + a.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Record
          <select name="entity" defaultValue={filters.entity ?? ""} className={inputClass}>
            <option value="">Any</option>
            {AUDIT_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button type="submit" className={buttonClass}>
            Filter
          </button>
          {(filters.action || filters.entity || filters.actorId) && (
            <Link href="/admin/audit" className="pb-2 font-medium text-pink-700 underline dark:text-pink-300">
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className={`text-sm ${mutedClass}`}>
        {total} {total === 1 ? "entry" : "entries"}
        {pages > 1 ? `, page ${filters.page} of ${pages}` : ""}
      </p>
      {entries.length > 0 && (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className={mutedClass}>
              <tr>
                <th className={thClass}>When (UTC)</th>
                <th className={thClass}>Who</th>
                <th className={thClass}>Action</th>
                <th className={thClass}>Record</th>
                <th className={thClass}>Details</th>
              </tr>
            </thead>
            <tbody className="text-zinc-900 dark:text-zinc-100">
              {entries.map((e) => {
                const href = entityHref(e.entity, e.entityId, e.after, e.before);
                const details = describeChange(e.before, e.after);
                return (
                  <tr key={e.id} className="border-t border-pink-100 align-top dark:border-pink-950">
                    <td className={`${tdClass} whitespace-nowrap`}>{when(e.at)}</td>
                    <td className={tdClass}>
                      <div>{e.actor.name}</div>
                      <div className={`text-xs ${mutedClass}`}>{e.actor.email}</div>
                    </td>
                    <td className={tdClass}>{e.action.charAt(0) + e.action.slice(1).toLowerCase()}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {href ? (
                        <Link href={href} className="underline decoration-pink-300 underline-offset-2">
                          {e.entity}
                        </Link>
                      ) : (
                        e.entity
                      )}
                    </td>
                    <td className={`${tdClass} max-w-md break-words ${mutedClass}`}>{details || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex gap-4 text-sm font-medium">
          {filters.page > 1 && (
            <Link href={pageHref(filters.page - 1)} className="text-pink-700 underline dark:text-pink-300">
              ← Newer
            </Link>
          )}
          {filters.page < pages && (
            <Link href={pageHref(filters.page + 1)} className="text-pink-700 underline dark:text-pink-300">
              Older →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

export default function AuditPage(props: PageProps<"/admin/audit">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Audit searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
