export type PinColor = {
  hex: string;
  name: string;
};

export const PIN_COLORS: PinColor[] = [
  { hex: "#15803D", name: "Emerald" },
  { hex: "#0284C7", name: "Sky" },
  { hex: "#D97706", name: "Amber" },
  { hex: "#E11D48", name: "Rose" },
  { hex: "#7C3AED", name: "Violet" },
  { hex: "#475569", name: "Slate" },
  { hex: "#C026D3", name: "Fuchsia" },
  { hex: "#65A30D", name: "Lime" },
];

export const DEFAULT_PIN_COLOR = "#15803D";

export function colorName(hex: string): string {
  const found = PIN_COLORS.find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase()
  );
  return found?.name ?? hex;
}

export type PinPreset = {
  species: string;
  color: string;
};

// Five quick-add presets shown by the speed dial. Tap drops a pin at the
// crosshair (= map center) prefilled with this species + color, then opens
// the drawer for description/quantity. Pick "Other" for anything outside
// these four — the user can rename in the drawer.
export const PIN_PRESETS: PinPreset[] = [
  { species: "Oak", color: "#15803D" },
  { species: "Pine", color: "#D97706" },
  { species: "Cypress", color: "#0284C7" },
  { species: "Palm", color: "#65A30D" },
  { species: "Other", color: "#475569" },
];
