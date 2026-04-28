import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { TreeProject, TreePin } from "@/lib/types";
import { formatLongDate } from "@/lib/utils";

type SpeciesRow = {
  species_name: string;
  pin_count: number;
  tree_count: number;
  pin_numbers: number[];
  description: string | null;
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id!;
  const [project, setProject] = useState<TreeProject | null>(null);
  const [pins, setPins] = useState<TreePin[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: pData, error: pErr }, { data: pinData, error: pinErr }] =
        await Promise.all([
          supabase.from("tree_projects").select("*").eq("id", projectId).single(),
          supabase
            .from("tree_pins")
            .select("*")
            .eq("project_id", projectId)
            .order("pin_number", { ascending: true }),
        ]);
      if (!active) return;
      if (pErr) setError(pErr.message);
      if (pinErr) setError(pinErr.message);
      setProject((pData as TreeProject) ?? null);
      setPins((pinData as TreePin[]) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  const bySpecies: SpeciesRow[] = useMemo(() => {
    const map = new Map<string, SpeciesRow>();
    for (const p of pins) {
      const key = p.species_name.trim();
      const row = map.get(key);
      if (row) {
        row.pin_count += 1;
        row.tree_count += p.quantity;
        row.pin_numbers.push(p.pin_number);
        if (!row.description && p.description) row.description = p.description;
      } else {
        map.set(key, {
          species_name: key,
          pin_count: 1,
          tree_count: p.quantity,
          pin_numbers: [p.pin_number],
          description: p.description ?? null,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.tree_count - a.tree_count);
  }, [pins]);

  const totals = useMemo(() => {
    const totalPins = pins.length;
    const totalTrees = pins.reduce((s, p) => s + p.quantity, 0);
    return { totalPins, totalTrees };
  }, [pins]);

  return (
    <main className="min-h-screen bg-paper">
      <div className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink/10 bg-paper/95 px-4 py-2 backdrop-blur">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/p/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to map
          </Link>
        </Button>
        <Button variant="accent" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      {error ? (
        <div className="no-print mx-auto mt-3 max-w-3xl rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <article className="report mx-auto max-w-3xl px-6 py-10 text-ink">
        <header className="mb-8 flex items-start justify-between gap-6 border-b border-ink/15 pb-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">
              Tree Inventory Report
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {project?.name ?? "Property"}
            </h1>
            {project?.address ? (
              <p className="mt-1 text-sm text-ink/70">{project.address}</p>
            ) : null}
            <p className="mt-2 text-sm text-ink/60">
              Walk-through:{" "}
              {project ? formatLongDate(project.created_at) : "—"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold tracking-tight">
              Higuera Tree Care
            </div>
            <div className="text-xs text-ink/60">zellin.ai</div>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-2 gap-6">
          <div className="rounded-lg border border-ink/10 p-4">
            <div className="text-xs uppercase tracking-wider text-ink/50">
              Total pins
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">
              {totals.totalPins}
            </div>
          </div>
          <div className="rounded-lg border border-ink/10 p-4">
            <div className="text-xs uppercase tracking-wider text-ink/50">
              Total trees
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">
              {totals.totalTrees}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Species summary
          </h2>
          {bySpecies.length === 0 ? (
            <p className="text-sm text-ink/60">No pins recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-ink/15 text-left text-xs uppercase tracking-wider text-ink/50">
                <tr>
                  <th className="py-2 pr-4 font-medium">Species</th>
                  <th className="py-2 pr-4 text-right font-medium">Pins</th>
                  <th className="py-2 pr-4 text-right font-medium">Trees</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {bySpecies.map((row) => (
                  <tr
                    key={row.species_name}
                    className="border-b border-ink/5 align-top"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {row.species_name}
                      <div className="text-xs text-ink/50">
                        #{row.pin_numbers.join(", #")}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.pin_count}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.tree_count}
                    </td>
                    <td className="py-2 text-ink/70">
                      {row.description ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold tracking-tight">Summary</h2>
          <p className="text-sm text-ink/80">
            Total pins: {totals.totalPins}. Total trees represented:{" "}
            {totals.totalTrees} (sum of per-pin quantities).
          </p>
        </section>

        {project?.description ? (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-ink/80">
              {project.description}
            </p>
          </section>
        ) : null}

        {pins.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              Pin detail
            </h2>
            <ol className="space-y-2 text-sm">
              {pins.map((p) => (
                <li
                  key={p.id}
                  className="flex items-baseline gap-3 border-b border-ink/5 pb-1.5"
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg text-xs font-semibold">
                    {p.pin_number}
                  </span>
                  <span className="flex-1">
                    <span className="font-medium">{p.species_name}</span>
                    {p.quantity > 1 ? (
                      <span className="text-ink/60"> · ×{p.quantity}</span>
                    ) : null}
                    {p.description ? (
                      <span className="block text-xs text-ink/60">
                        {p.description}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <footer className="mt-10 border-t border-ink/10 pt-4 text-xs text-ink/50">
          Generated {formatLongDate(new Date().toISOString())} · zellin.ai
        </footer>
      </article>
    </main>
  );
}
