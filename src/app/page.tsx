export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-pink-50 px-6 py-24 text-center dark:bg-zinc-950">
      <span aria-hidden className="text-7xl">🐷</span>
      <h1 className="text-4xl font-semibold tracking-tight text-pink-900 dark:text-pink-100">
        Kumbara
      </h1>
      <p className="max-w-md text-lg text-pink-800/80 dark:text-pink-200/80">
        Track every coin that goes in and out, with receipts and exchange rates.
      </p>
    </main>
  );
}
