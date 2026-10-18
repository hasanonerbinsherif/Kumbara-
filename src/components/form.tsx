// Small shared form pieces so every form looks and behaves the same.

export const inputClass =
  "w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-pink-500 dark:border-pink-900 dark:bg-zinc-900 dark:text-zinc-100";

export const buttonClass =
  "rounded-lg bg-pink-600 px-4 py-2 font-semibold text-white hover:bg-pink-700 disabled:opacity-60";

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-pink-950 dark:text-pink-100">
      {label}
      {children}
      {hint && !error?.length && <span className="font-normal text-pink-800/60 dark:text-pink-200/60">{hint}</span>}
      {error?.length ? (
        <span role="alert" className="font-normal text-red-700 dark:text-red-400">
          {error[0]}
        </span>
      ) : null}
    </label>
  );
}
