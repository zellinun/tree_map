import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIN_PRESETS, type PinPreset } from "@/lib/colors";

type Props = {
  onPick: (preset: PinPreset) => void;
};

// Floating + bottom-right; tap to fan out 5 preset chips. Tapping a chip
// drops a pin at the crosshair and closes the menu.
export default function NewPinSpeedDial({ onPick }: Props) {
  const [open, setOpen] = useState(false);

  // Esc to close on desktop.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open ? (
        <div
          className="absolute inset-0 z-[950] bg-black/10"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="absolute bottom-0 right-0 z-[1000] m-4 mb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col items-end gap-2.5">
        {open
          ? PIN_PRESETS.map((p, i) => (
              <button
                key={p.species}
                type="button"
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-full bg-paper py-2 pl-2 pr-4 shadow-lg",
                  "border border-ink/10 transition active:scale-95",
                  "animate-[fadeUp_180ms_ease_both]"
                )}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-paper"
                  style={{ background: p.color }}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-ink">
                  {p.species}
                </span>
              </button>
            ))
          : null}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close pin presets" : "Add a new pin"}
          aria-expanded={open}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition active:scale-95",
            "bg-accent text-accent-fg",
            open && "bg-ink"
          )}
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
}
