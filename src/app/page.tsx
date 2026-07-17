import NavBar from "@/components/NavBar";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <NavBar />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to Style Me</h1>
        <p className="mt-2 text-slate-600">
          Your AI wardrobe assistant. Catalog clothes, get outfit suggestions, and try looks on a selfie.
        </p>

        <div className="grid gap-6 md:grid-cols-3 mt-8">
          <div className="p-5 border rounded-xl bg-white">
            <h2 className="text-xl font-semibold">Build Your Closet</h2>
            <p className="text-sm text-slate-600 mt-2">
              Upload clothing photos and add tags like type, color, season.
            </p>
            <Link href="/closet" className="inline-block mt-4 border rounded px-3 py-2 hover:bg-slate-50">
              Open Closet
            </Link>
          </div>

          <div className="p-5 border rounded-xl bg-white">
            <h2 className="text-xl font-semibold">Get an Outfit</h2>
            <p className="text-sm text-slate-600 mt-2">
              Choose an occasion and weather; get a smart combo from your closet.
            </p>
            <Link href="/outfit" className="inline-block mt-4 border rounded px-3 py-2 hover:bg-slate-50">
              See Suggestions
            </Link>
          </div>

          <div className="p-5 border rounded-xl bg-white">
            <h2 className="text-xl font-semibold">Try It On</h2>
            <p className="text-sm text-slate-600 mt-2">
              Upload a selfie and preview how it looks with simple overlay tools.
            </p>
            <Link href="/try-on" className="inline-block mt-4 border rounded px-3 py-2 hover:bg-slate-50">
              Start Try-On
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
