"use client";

import { useActionState } from "react";
import { Field, buttonClass, inputClass } from "@/components/form";
import { MIN_PASSWORD } from "@/lib/password-rules";
import { addUser, changeRole, setPassword } from "./actions";

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUser, undefined);
  const v = state?.values;
  return (
    <form
      action={action}
      key={state?.at ?? 0}
      className="grid gap-4 rounded-xl border border-pink-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.5fr_1.2fr_0.8fr_auto] lg:items-start dark:border-pink-900 dark:bg-zinc-900"
    >
      <Field label="Name" error={state?.errors?.name}>
        <input name="name" required maxLength={80} defaultValue={v?.name} className={inputClass} />
      </Field>
      <Field label="Email" error={state?.errors?.email}>
        <input name="email" type="email" required defaultValue={v?.email} autoComplete="off" className={inputClass} />
      </Field>
      <Field label="Password" error={state?.errors?.password} hint={`${MIN_PASSWORD}+ characters`}>
        <input
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      <Field label="Role" error={state?.errors?.role}>
        <select name="role" defaultValue={v?.role ?? "USER"} className={inputClass}>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
      </Field>
      <button type="submit" disabled={pending} className={`${buttonClass} lg:mt-6`}>
        {pending ? "Adding…" : "Add user"}
      </button>
      {state?.formError && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-5 dark:text-red-400">
          {state.formError}
        </p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-700 sm:col-span-2 lg:col-span-5 dark:text-emerald-400">{state.ok}</p>
      )}
    </form>
  );
}

const smallButton =
  "rounded-md border border-pink-200 px-2 py-1 text-xs font-medium text-pink-800 hover:border-pink-400 disabled:opacity-60 dark:border-pink-900 dark:text-pink-200";

export function UserRowActions({
  userId,
  name,
  role,
  isSelf,
}: {
  userId: string;
  name: string;
  role: "ADMIN" | "USER";
  isSelf: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(changeRole, undefined);
  const [pwState, pwAction, pwPending] = useActionState(setPassword, undefined);
  const message = [roleState, pwState].filter(Boolean).sort((a, b) => b!.at - a!.at)[0];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {!isSelf && (
          <form
            action={roleAction}
            onSubmit={(e) => {
              const verb =
                role === "ADMIN"
                  ? `Remove Admin rights from ${name}?`
                  : `Make ${name} an Admin? They will see everyone's money.`;
              if (!confirm(verb)) e.preventDefault();
            }}
          >
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="role" value={role === "ADMIN" ? "USER" : "ADMIN"} />
            <button type="submit" disabled={rolePending} className={smallButton}>
              {role === "ADMIN" ? "Make regular user" : "Make Admin"}
            </button>
          </form>
        )}
        <details>
          <summary className={`${smallButton} cursor-pointer list-none`}>Set password</summary>
          <form action={pwAction} key={pwState?.ok ? pwState.at : 0} className="mt-2 flex gap-2">
            <input type="hidden" name="userId" value={userId} />
            <input
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              aria-label={`New password for ${name}`}
              placeholder={`${MIN_PASSWORD}+ characters`}
              className={`${inputClass} py-1 text-sm`}
            />
            <button type="submit" disabled={pwPending} className={smallButton}>
              Save
            </button>
          </form>
        </details>
      </div>
      {message?.error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {message.error}
        </p>
      )}
      {message?.ok && <p className="text-xs text-emerald-700 dark:text-emerald-400">{message.ok}</p>}
    </div>
  );
}
