// Shared look for Style Me (friendly, rounded, cream and coral). Class strings only,
// so any page can use them. Colours live in globals.css.

export const fieldCls =
  "w-full border border-ink/15 bg-white text-ink px-4 py-3 rounded-2xl text-sm placeholder:text-ink/40 focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/25";
export const labelCls = "text-xs font-semibold text-ink/60";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";
// The one main action on a screen.
export const primaryBtn = `${btnBase} text-sm bg-coral text-white px-5 py-3 hover:bg-coral-dark`;
// Everything else.
export const outlineBtn = `${btnBase} text-sm font-medium bg-white text-ink border border-ink/15 px-4 py-2.5 hover:bg-ink/5`;
// A quiet text-only action.
export const linkBtn = "text-sm font-medium text-ink/60 underline-offset-2 hover:text-coral hover:underline";

export const chipCls = "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full";

// A white surface (forms, panels) and a smaller white card (items).
export const panelCls = "bg-white text-ink rounded-3xl p-5 soft-shadow";
export const cardCls = "bg-white text-ink rounded-2xl p-3 soft-shadow";

// A whole page: cream background, room at the bottom for the tab bar.
export const pageCls = "min-h-screen bg-cream text-ink font-body pb-32";
// The centred column every page content sits in.
export const containerCls = "mx-auto w-full max-w-3xl px-4 pt-6";
export const h1Cls = "text-2xl font-extrabold tracking-tight text-ink";
export const h2Cls = "text-lg font-bold text-ink";
export const mutedCls = "text-sm text-ink/60";
