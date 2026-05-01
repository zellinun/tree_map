import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapView from "@/components/MapView";
import { supabase } from "@/lib/supabase";
import type { TreeProject, TreePin } from "@/lib/types";
import { formatLongDate } from "@/lib/utils";
import { DEFAULT_PIN_COLOR } from "@/lib/colors";
import { displayColor } from "@/lib/species";

type SpeciesRow = {
  species_name: string;
  pin_count: number;
  tree_count: number;
  pin_numbers: number[];
  description: string | null;
  dominant_color: string;
  colors: string[];
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
      const color = displayColor(p.color || DEFAULT_PIN_COLOR, p.species_name);
      const row = map.get(key);
      if (row) {
        row.pin_count += 1;
        row.tree_count += p.quantity;
        row.pin_numbers.push(p.pin_number);
        if (!row.description && p.description) row.description = p.description;
        if (!row.colors.includes(color)) row.colors.push(color);
      } else {
        map.set(key, {
          species_name: key,
          pin_count: 1,
          tree_count: p.quantity,
          pin_numbers: [p.pin_number],
          description: p.description ?? null,
          dominant_color: color,
          colors: [color],
        });
      }
    }
    for (const [key, row] of map.entries()) {
      const counts = new Map<string, number>();
      for (const p of pins) {
        if (p.species_name.trim() !== key) continue;
        const c = displayColor(p.color || DEFAULT_PIN_COLOR, p.species_name);
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      let best = row.dominant_color;
      let bestN = 0;
      for (const [c, n] of counts) {
        if (n > bestN) {
          best = c;
          bestN = n;
        }
      }
      row.dominant_color = best;
    }
    return Array.from(map.values()).sort((a, b) => b.tree_count - a.tree_count);
  }, [pins]);

  const totals = useMemo(() => {
    const totalPins = pins.length;
    const totalTrees = pins.reduce((s, p) => s + p.quantity, 0);
    return { totalPins, totalTrees };
  }, [pins]);

  const mapCenter: [number, number] =
    pins.length > 0
      ? [pins[0].latitude, pins[0].longitude]
      : [37.9735, -122.5311];

  const handlePrint = () => {
    // Browsers throttle window.print() if not invoked from a user gesture
    // — this handler runs from a button onClick so it's fine.
    setTimeout(() => window.print(), 50);
  };

  return (
    <main className="min-h-screen bg-paper">
      <div className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink/10 bg-paper/95 px-4 py-2 backdrop-blur">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/p/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to map
          </Link>
        </Button>
        <Button variant="accent" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      {error ? (
        <div className="no-print mx-auto mt-3 max-w-5xl rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* On-screen preview is constrained to a max width so it's readable
          on a phone, but the print stylesheet sizes everything to letter
          landscape. */}
      <article className="report mx-auto max-w-[10.5in] px-6 py-8 text-ink">
        {/* ──────────── PAGE 1: header + map + species summary ──────────── */}
        <section className="report-page">
          <header className="report-header mb-4 flex items-end justify-between gap-6 border-b border-ink/15 pb-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/50">
                Tree Inventory Report
              </div>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
                {project?.name ?? "Property"}
              </h1>
              {project?.address ? (
                <p className="mt-0.5 truncate text-sm text-ink/70">
                  {project.address}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tracking-tight">
                Higuera Tree Care
              </div>
              <div className="text-[11px] text-ink/60">
                {project ? formatLongDate(project.created_at) : "—"}
              </div>
              <div className="text-[11px] text-ink/40">zellin.ai</div>
            </div>
          </header>

          {/* Two-column body: map left, summary + species table right.
              On screen at narrow widths it stacks; print always shows
              side-by-side via the report-body grid utility class. */}
          <div className="report-body grid grid-cols-1 gap-5 md:grid-cols-[1.6fr_1fr]">
            {/* Map */}
            <div className="report-map-wrap">
              {pins.length > 0 ? (
                <>
                  <div className="report-map h-[5in] min-h-[320px] w-full overflow-hidden rounded-lg border border-ink/10">
                    <MapView
                      pins={pins}
                      center={mapCenter}
                      zoom={19}
                      fitToPins
                      fitTrigger={1}
                      interactive={false}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-ink/45">
                    Numbered, color-coded markers correspond to the species
                    list. Allow a few seconds for satellite tiles to load
                    before printing.
                  </p>
                </>
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-dashed border-ink/15 text-sm text-ink/50">
                  No pins recorded yet.
                </div>
              )}
            </div>

            {/* Right column: totals + species summary */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-ink/10 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink/50">
                    Pins
                  </div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                    {totals.totalPins}
                  </div>
                </div>
                <div className="rounded-lg border border-ink/10 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink/50">
                    Trees
                  </div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                    {totals.totalTrees}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink/60">
                  Species summary
                </h2>
                {bySpecies.length === 0 ? (
                  <p className="text-xs text-ink/60">No pins recorded yet.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="border-b border-ink/15 text-left text-[10px] uppercase tracking-wider text-ink/50">
                      <tr>
                        <th className="py-1.5 pr-2 font-medium"></th>
                        <th className="py-1.5 pr-2 font-medium">Species</th>
                        <th className="py-1.5 pr-2 text-right font-medium">
                          Pins
                        </th>
                        <th className="py-1.5 text-right font-medium">
                          Trees
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySpecies.map((row) => (
                        <tr
                          key={row.species_name}
                          className="border-b border-ink/5 align-top"
                        >
                          <td className="py-1.5 pr-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full border border-ink/15"
                              style={{ background: row.dominant_color }}
                            />
                          </td>
                          <td className="py-1.5 pr-2 font-medium">
                            {row.species_name}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">
                            {row.pin_count}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {row.tree_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {project?.description ? (
                <div>
                  <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink/60">
                    Notes
                  </h2>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink/80">
                    {project.description}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ──────────── PAGE 2+: every pin in detail ──────────── */}
        {pins.length > 0 ? (
          <section className="report-page report-page-break mt-6">
            <header className="report-header mb-3 flex items-end justify-between gap-6 border-b border-ink/15 pb-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/50">
                  Pin Detail · {project?.name ?? ""}
                </div>
                <h2 className="mt-0.5 text-base font-semibold tracking-tight">
                  All {pins.length} pins
                </h2>
              </div>
              <div className="text-right text-[10px] text-ink/40">
                Higuera Tree Care · zellin.ai
              </div>
            </header>

            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs md:grid-cols-3">
              {pins.map((p) => (
                <li
                  key={p.id}
                  className="flex items-baseline gap-2 border-b border-ink/5 pb-1"
                >
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-paper text-[10px] font-semibold"
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
                    <span className="truncate font-medium">
                      {p.species_name}
                    </span>
                    {p.quantity > 1 ? (
                      <span className="text-ink/60"> ×{p.quantity}</span>
                    ) : null}
                    {p.description ? (
                      <span className="block truncate text-[10px] text-ink/55">
                        {p.description}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="mt-6 border-t border-ink/10 pt-2 text-[10px] text-ink/40">
          Generated {formatLongDate(new Date().toISOString())} ·{" "}
          {totals.totalPins} pins · {totals.totalTrees} trees · zellin.ai
        </footer>
      </article>
    </main>
  );
}
