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
