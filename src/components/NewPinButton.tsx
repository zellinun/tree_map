import { Plus } from "lucide-react";

type Props = {
  onClick: () => void;
};

// The single bottom-right + button. First of the 2 clicks to drop a pin.
// Tapping opens the SpeciesPicker drawer.
export default function NewPinButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add a new pin"
      className="absolute bottom-0 right-0 z-[1000] m-4 mb-[max(1rem,env(safe-area-inset-bottom))] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg transition active:scale-95"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
