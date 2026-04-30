import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  addCustomSpecies,
  allSpeciesSorted,
  colorForSpecies,
  readCustomSpecies,
} from "@/lib/species";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (species: string) => void;
};

export default function SpeciesPicker({ open, onOpenChange, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reload customs and reset query on every open.
  useEffect(() => {
    if (open) {
      setCustom(readCustomSpecies());
      setQuery("");
      // Defer focus so the drawer enter animation doesn't fight us.
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  const all = useMemo(() => allSpeciesSorted(custom), [custom]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((s) => s.toLowerCase().includes(q));
  }, [all, query]);

  const showAddRow = useMemo(() => {
    const q = query.trim();
    if (!q) return false;
    const lc = q.toLowerCase();
    return !all.some((s) => s.toLowerCase() === lc);
  }, [all, query]);

  const handlePick = (species: string) => {
    onPick(species);
  };

  const handleAddNew = () => {
    const name = query.trim();
    if (!name) return;
    const next = addCustomSpecies(name);
    setCustom(next);
    onPick(name);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-h-[85vh] flex-col">
        <DrawerHeader>
          <DrawerTitle>Add a pin</DrawerTitle>
        </DrawerHeader>
        <div className="border-b border-ink/10 bg-paper px-5 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search species…"
              autoCapitalize="words"
              autoCorrect="off"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          {showAddRow ? (
            <button
              type="button"
              onClick={handleAddNew}
              className="flex w-full items-center gap-3 border-b border-ink/5 bg-accent/5 px-5 py-3 text-left active:bg-accent/10"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                <Plus className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  Add &ldquo;{query.trim()}&rdquo;
                </span>
                <span className="block text-xs text-ink/60">
                  Save as a new species and drop a pin
                </span>
              </span>
            </button>
          ) : null}

          {filtered.length === 0 && !showAddRow ? (
            <div className="px-5 py-10 text-center text-sm text-ink/50">
              No matches.
            </div>
          ) : (
            <ul className="divide-y divide-ink/5">
              {filtered.map((s) => {
                const isCustom = custom.includes(s);
                return (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => handlePick(s)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-ink/5"
                    >
                      <span
                        className="inline-block h-4 w-4 shrink-0 rounded-full border border-ink/15"
                        style={{ background: colorForSpecies(s) }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-base text-ink">
                        {s}
                      </span>
                      {isCustom ? (
                        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink/50">
                          Custom
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
