import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in · Kumbara" };

async function LoginWithNext({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-pink-50 px-6 py-24 dark:bg-zinc-950">
      <span aria-hidden className="text-6xl">🐷</span>
      <h1 className="text-3xl font-semibold tracking-tight text-pink-900 dark:text-pink-100">
        Log in to Kumbara
      </h1>
      <Suspense fallback={<LoginForm />}>
        <LoginWithNext searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
