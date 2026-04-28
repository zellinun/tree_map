import { Link } from "react-router-dom";
import { TreePine } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  right?: React.ReactNode;
  back?: { to: string; label?: string };
  className?: string;
};

export default function Header({ title, right, back, className }: Props) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ink/10 bg-paper/90 px-4 backdrop-blur",
        "pt-[env(safe-area-inset-top)]",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {back ? (
          <Link
            to={back.to}
            className="text-sm font-medium text-ink/70 hover:text-ink"
          >
            {back.label ?? "Back"}
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2 text-ink">
            <TreePine className="h-5 w-5 text-accent" />
            <span className="text-sm font-semibold tracking-tight">
              Higuera Tree Care
            </span>
          </Link>
        )}
      </div>
      {title ? (
        <div className="truncate text-sm font-medium text-ink/80">{title}</div>
      ) : null}
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}
