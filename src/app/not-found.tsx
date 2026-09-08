import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <Link href="/" className="mt-4 inline-block text-primary">Home</Link>
      </div>
    </main>
  );
}
