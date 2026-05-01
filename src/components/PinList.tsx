import type { TreePin } from "@/lib/types";
import EmptyState from "./EmptyState";
import { TreePine } from "lucide-react";
import { DEFAULT_PIN_COLOR } from "@/lib/colors";
import { displayColor } from "@/lib/species";

type Props = {
  pins: TreePin[];
  onSelect: (pin: TreePin) => void;
};

export default function PinList({ pins, onSelect }: Props) {
  if (pins.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={<TreePine className="h-8 w-8" />}
          title="No pins yet"
          description='Tap "Pin Here" or long-press the map to drop your first pin.'
        />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink/5">
      {pins.map((p) => (
        <li key={p.id}>
          <button
            onClick={() => onSelect(p)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ink/5"
          >
            <span
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-paper text-xs font-semibold ring-2 ring-paper"
              style={{
                background: displayColor(
                  p.color || DEFAULT_PIN_COLOR,
                  p.species_name
                ),
              }}
            >
              {p.pin_number}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">
                  {p.species_name}
                </span>
                <span className="shrink-0 text-xs font-medium text-ink/60">
                  ×{p.quantity}
                </span>
              </span>
              {p.description ? (
                <span className="mt-0.5 line-clamp-2 block text-xs text-ink/60">
                  {p.description}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
