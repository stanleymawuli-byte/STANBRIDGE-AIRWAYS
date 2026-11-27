import Link from "next/link";

export const metadata = { title: "You are offline | StanBridge Airways" };

export default function OfflinePage() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#f8f7f4] p-6">
      <section className="max-w-md rounded-2xl bg-white border border-[#e8e4da] p-8 shadow-sm">
        <p className="text-xs tracking-[0.2em] text-[#a17d4b] font-bold">STANBRIDGE AIRWAYS</p>
        <h1 className="text-3xl font-serif text-[#071d32] mt-3">You are offline</h1>
        <p className="text-sm text-slate-600 mt-3">We could not reach StanBridge Airways. Check your connection and try again. Account, administration and payment information is never stored for offline use.</p>
        <Link href="/" className="inline-flex mt-6 rounded-lg bg-[#071d32] text-white px-5 py-3 text-sm font-semibold">Try again</Link>
      </section>
    </main>
  );
}
