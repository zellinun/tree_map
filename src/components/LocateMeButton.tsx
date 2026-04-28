import { LocateFixed, Loader2 } from "lucide-react";

type Props = {
  onClick: () => void;
  loading?: boolean;
};

// Small floating button bottom-LEFT that recenters the map on the user's
// current GPS position. Pairs with the speed dial bottom-RIGHT.
export default function LocateMeButton({ onClick, loading }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Center map on my location"
      className="absolute bottom-0 left-0 z-[900] m-4 mb-[max(1rem,env(safe-area-inset-bottom))] flex h-12 w-12 items-center justify-center rounded-full border border-ink/10 bg-paper text-ink shadow-lg transition active:scale-95 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <LocateFixed className="h-5 w-5" />
      )}
    </button>
  );
}
