import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export default function EmptyState({ title, description, action, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-ink/15 px-6 py-12 text-center">
      {icon ? <div className="text-ink/40">{icon}</div> : null}
      <div className="space-y-1">
        <div className="text-base font-semibold">{title}</div>
        {description ? (
          <div className="text-sm text-ink/60 max-w-sm">{description}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
