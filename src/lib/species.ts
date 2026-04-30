import { PIN_COLORS } from "./colors";

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

// Deterministic species → palette color, so the same species name always gets
// the same color across pins, projects, sessions, and devices. With 41
// built-ins and an 8-color palette, multiple species share a color — the
// numbered marker + report legend table is the canonical identifier; color
// is a visual aid the user can still override per-pin.
export function colorForSpecies(name: string): string {
  const trimmed = name.trim().toLowerCase();
  let h = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < trimmed.length; i++) {
    h ^= trimmed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = (h >>> 0) % PIN_COLORS.length;
  return PIN_COLORS[idx].hex;
}

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
