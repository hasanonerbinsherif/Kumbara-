import { logout } from "@/app/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-lg border border-pink-300 px-3 py-1.5 text-sm font-medium text-pink-900 hover:bg-pink-100 dark:border-pink-800 dark:text-pink-100 dark:hover:bg-pink-950"
      >
        Log out
      </button>
    </form>
  );
}
