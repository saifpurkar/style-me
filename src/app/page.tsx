import NavBar from "@/components/NavBar";
import Link from "next/link";
import { labelCls, pageCls, panelCls, primaryBtn } from "@/lib/ui";

const STEPS = [
  {
    number: "01",
    title: "Build your closet",
    body: "Add a photo of each piece. Style Me suggests the category, occasions and formality, and you confirm.",
    href: "/closet",
    cta: "Open closet",
  },
  {
    number: "02",
    title: "Get an outfit",
    body: "Pick an occasion and how dressed up you want to be. Swap any piece, or the whole outfit, until it feels right.",
    href: "/outfit",
    cta: "See outfits",
  },
  {
    number: "03",
    title: "Try it on",
    body: "Upload a selfie and preview your picks over it.",
    href: "/try-on",
    cta: "Start try-on",
  },
];

export default function Home() {
  return (
    <main className={pageCls}>
      <NavBar />

      <section className="mx-auto max-w-6xl px-4 py-14">
        <p className="font-utility text-xs uppercase tracking-wider text-brass">Your wardrobe, sorted</p>
        <h1 className="mt-3 font-display font-semibold text-5xl text-paper">Style Me</h1>
        <p className="mt-4 max-w-xl text-paper/80">
          Catalog your clothes, get outfits for any occasion, and see how they look on you.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.href} className={`${panelCls} flex flex-col`}>
              <span className={labelCls}>{s.number}</span>
              <h2 className="mt-2 font-display font-semibold text-xl">{s.title}</h2>
              <p className="mt-2 text-sm text-ink/70 flex-1">{s.body}</p>
              <Link href={s.href} className={`${primaryBtn} mt-5 self-start`}>
                {s.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
