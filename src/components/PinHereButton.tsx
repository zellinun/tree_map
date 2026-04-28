import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function PinHereButton({ onClick, loading, disabled }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button
        onClick={onClick}
        disabled={disabled || loading}
        variant="accent"
        size="xl"
        className="pointer-events-auto w-full text-base font-semibold tracking-tight shadow-lg"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <MapPin className="h-5 w-5" />
        )}
        {loading ? "Locating…" : "Pin Here"}
      </Button>
    </div>
  );
}
