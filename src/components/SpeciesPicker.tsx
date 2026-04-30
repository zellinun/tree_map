import { useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { SPECIES_LIST } from "@/lib/species";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (species: string) => void;
  onAddNew: () => void;
};

export default function SpeciesPicker({
  open,
  onOpenChange,
  onSelect,
  onAddNew,
}: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  if (!open) return null;

  const filtered = SPECIES_LIST.filter((s) =>
    s.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[72vh] flex-col rounded-t-2xl bg-white shadow-2xl">
        <div className="flex justify-center px-4 pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <span className="text-base font-semibold text-gray-900">Select species</span>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 active:bg-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search species..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No matches — use Add new below.</p>
          )}
          {filtered.map((species) => (
            <button
              key={species}
              onClick={() => {
                onSelect(species);
                onOpenChange(false);
              }}
              className="flex w-full items-center border-b border-gray-100 px-4 py-3.5 text-left text-base font-medium text-gray-800 active:bg-green-50"
            >
              {species}
            </button>
          ))}
          <button
            onClick={() => {
              onOpenChange(false);
              onAddNew();
            }}
            className="flex w-full items-center gap-2 border-t border-gray-200 px-4 py-4 text-left text-base font-medium text-green-700 active:bg-green-50"
          >
            <Plus className="h-5 w-5 flex-shrink-0" />
            Add new species
          </button>
        </div>
      </div>
    </>
  );
}
