"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">{error.message}</p>
        <button type="button" onClick={reset} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm text-white">
          Try again
        </button>
      </div>
    </main>
  );
}
