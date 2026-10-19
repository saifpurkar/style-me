import Link from "next/link";
import NavBar from "@/components/NavBar";
import Icon, { type IconName } from "@/components/Icon";
import { OCCASIONS } from "@/lib/outfit";
import { TONES, label, occasionTone } from "@/lib/labels";
import { containerCls, h2Cls, mutedCls, pageCls, panelCls } from "@/lib/ui";

const QUICK: { href: string; title: string; body: string; icon: IconName; tone: keyof typeof TONES }[] = [
  { href: "/closet?add=1", title: "Add a piece", body: "Snap a photo, we fill in the details.", icon: "selfie", tone: "sky" },
  { href: "/try-on", title: "Try it on", body: "See your picks on your selfie.", icon: "tryon", tone: "lilac" },
];

export default function Home() {
  return (
    <main className={pageCls}>
      <div className={containerCls}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-coral text-white">
            <Icon name="closet" className="h-6 w-6" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">Style Me</span>
        </div>

        <section className="mt-6 rounded-[28px] bg-coral p-6 text-white soft-shadow">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">What are you wearing today?</h1>
          <p className="mt-2 max-w-sm text-sm text-white/85">
            Pick where you&apos;re headed and we&apos;ll put together an outfit from your own closet.
          </p>
          <Link
            href="/outfit"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-coral transition active:scale-[0.98]"
          >
            <Icon name="outfit" className="h-5 w-5" />
            Get an outfit
          </Link>
        </section>

        <section className="mt-8">
          <h2 className={h2Cls}>Where to?</h2>
          <p className={`${mutedCls} mt-0.5`}>Tap a place to see matching outfits.</p>
          <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5">
            {OCCASIONS.map((o) => (
              <Link key={o} href={`/outfit?occasion=${o}`} className="group flex flex-col items-center gap-1.5 text-center">
                <span className={`flex h-16 w-16 items-center justify-center rounded-full transition group-active:scale-95 ${TONES[occasionTone(o)].soft}`}>
                  <Icon name={o} className="h-7 w-7" />
                </span>
                <span className="text-xs font-semibold text-ink/80">{label(o)}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className={`${panelCls} flex items-center gap-4 transition active:scale-[0.99]`}>
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${TONES[q.tone].soft}`}>
                <Icon name={q.icon} className="h-7 w-7" />
              </span>
              <span>
                <span className="block text-base font-bold">{q.title}</span>
                <span className={mutedCls}>{q.body}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
      <NavBar />
    </main>
  );
}
