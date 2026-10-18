// Shared look for the Style Me design system (ink/paper/charcoal/denim/brass,
// 2px corners, thin rules). Class strings only, so any page can use them.

export const fieldCls =
  "border border-ink/30 bg-paper text-ink px-3 py-2 rounded-[2px] text-sm focus:outline-none focus:ring-1 focus:ring-denim";
export const labelCls = "font-utility text-[10px] uppercase tracking-wider text-ink/60";
export const primaryBtn =
  "font-utility text-xs uppercase tracking-wider bg-brass text-ink px-4 py-2 rounded-[2px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed";
export const outlineBtn =
  "font-utility text-[10px] uppercase tracking-wider border border-denim text-denim px-3 py-1.5 rounded-[2px] hover:bg-denim hover:text-paper";
export const chipCls =
  "font-utility text-[10px] uppercase tracking-wider border border-ink/25 text-ink/80 px-1.5 py-0.5 rounded-[2px]";

// A paper surface with a dashed edge (forms, panels) and a plain paper card (items).
export const panelCls = "bg-paper text-ink border border-dashed border-ink/40 rounded-[2px] p-5";
export const cardCls = "bg-paper text-ink border border-ink/20 rounded-[2px] p-4";

// A whole page: charcoal background, paper text, Inter body.
export const pageCls = "min-h-screen bg-charcoal text-paper font-body";
