// 41 built-in species, alphabetized at module load. Tracked separately from
// user-added customs so the built-ins are immutable.
export const BUILT_IN_SPECIES: readonly string[] = Object.freeze(
  [
    "Aleppo Pine",
    "Ash Species",
    "Avocado Tree",
    "Blue Gum",
    "Bottlebrush",
    "Bradford Callery Pear",
    "Brazilian Pepper Tree",
    "Bronze Loquat",
    "California Pepper Tree",
    "California Sycamore",
    "Camphor Tree",
    "Canary Island Pine",
    "Carob Tree",
    "Carrotwood",
    "Chinese Elm",
    "Coral Tree",
    "Crape Myrtle",
    "Evergreen Pear",
    "Gold Medallion Tree",
    "Hollywood Juniper",
    "Hong Kong Orchid Tree",
    "Jacaranda",
    "Koelreuteria Species",
    "Lemon-Scented Gum",
    "Leyland Cypress",
    "Liquidambar",
    "Magnolia Species",
    "Mexican Fan Palm",
    "Monterey Pine",
    "Red Flowering Gum",
    "Red Maple",
    "Rubber Fig",
    "Shiny Xylosma",
    "Silk Oak",
    "Silver Dollar Tree",
    "Stone Pine",
    "Strawberry Tree",
    "Tipu",
    "Tristania",
    "Tupidanthus",
    "Weeping Fig",
  ].sort((a, b) => a.localeCompare(b))
);

// Deterministic species → color. Hashes the species name to a hue in HSL
// space (360 distinct hues vs. 8 palette slots) so the 41 built-in species
// each render with a visually distinct color, stable across pins / projects
// / sessions / devices. Saturation + lightness are tuned for vivid
// readability over satellite imagery — the previous 70%/45% washed out
// against beige rooftops + bright pavement; 95%/50% pops.
//
// Hash collisions on hue are still possible (FNV → mod 360) but a 1-in-
// roughly-360 collision rate is dramatically better than the old 1-in-8.
export function colorForSpecies(name: string): string {
  const trimmed = name.trim().toLowerCase();
  let h = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < trimmed.length; i++) {
    h ^= trimmed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = (h >>> 0) % 360;
  return `hsl(${hue} 95% 50%)`;
}

// Resolve the color to render for a pin. If the stored color is in HSL
// form (auto-generated from the species), recompute it through the
// current colorForSpecies — that way bumps to the formula (e.g. brighter
// saturation) propagate to all existing pins on the next render without
// a DB migration. Hex colors are preserved as-is so manual overrides
// from the 8-color palette picker stick.
export function displayColor(color: string, speciesName: string): string {
  if (color.startsWith("hsl")) return colorForSpecies(speciesName);
  return color;
}

// PIN_COLORS is still exported for the manual override picker in PinSheet.
// Re-export so callers don't have to know about the dual-source.
export { PIN_COLORS } from "./colors";

const CUSTOM_KEY = "zellin:custom-species";

export function readCustomSpecies(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

export function addCustomSpecies(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return readCustomSpecies();
  const existing = readCustomSpecies();
  const lc = trimmed.toLowerCase();
  // De-dupe vs. customs and built-ins.
  const matchesBuiltIn = BUILT_IN_SPECIES.some(
    (s) => s.toLowerCase() === lc
  );
  const matchesCustom = existing.some((s) => s.toLowerCase() === lc);
  if (matchesBuiltIn || matchesCustom) return existing;
  const next = [...existing, trimmed].sort((a, b) => a.localeCompare(b));
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  return next;
}

export function allSpeciesSorted(custom: string[]): string[] {
  return [...BUILT_IN_SPECIES, ...custom].sort((a, b) => a.localeCompare(b));
}
