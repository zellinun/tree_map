import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Printer, ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import EditableText from "@/components/EditableText";
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

  const updateProjectName = async (next: string) => {
    if (!project) return;
    const { data, error: err } = await supabase
      .from("tree_projects")
      .update({ name: next })
      .eq("id", projectId)
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "Could not update title.");
      return;
    }
    setProject(data as TreeProject);
  };

  // Renaming a species rewrites every pin in this project whose
  // species_name matches the old label. The map markers, list view,
  // and report tables all derive labels (and hash-based color) from
  // pin.species_name, so a single batch update is enough to make the
  // change visible everywhere.
  const renameSpecies = async (oldName: string, newName: string) => {
    if (oldName === newName) return;
    const { error: err } = await supabase
      .from("tree_pins")
      .update({ species_name: newName })
      .eq("project_id", projectId)
      .eq("species_name", oldName);
    if (err) {
      setError(err.message);
      return;
    }
    setPins((prev) =>
      prev.map((p) =>
        p.species_name === oldName ? { ...p, species_name: newName } : p
      )
    );
  };

  // Two-step inline delete: tapping a row's trash icon arms a confirm
  // state; tapping the red Confirm button executes the delete. Cancel
  // (or tapping any other species' trash) clears the arm.
  const [confirming, setConfirming] = useState<string | null>(null);

  const deleteSpecies = async (species: string) => {
    const { error: err } = await supabase
      .from("tree_pins")
      .delete()
      .eq("project_id", projectId)
      .eq("species_name", species);
    if (err) {
      setError(err.message);
      return;
    }
    setPins((prev) => prev.filter((p) => p.species_name !== species));
    setConfirming(null);
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
                <EditableText
                  value={project?.name ?? "Property"}
                  onSave={updateProjectName}
                  className="-mx-1 px-1"
                  inputClassName="text-2xl font-semibold tracking-tight"
                  placeholder="Property name"
                />
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
          <div className="report-body grid grid-cols-1 items-stretch gap-5 md:grid-cols-[1.6fr_1fr]">
            {/* Map */}
            <div className="report-map-wrap flex h-full flex-col gap-1">
              {pins.length > 0 ? (
                <>
                  <div className="report-map relative w-full flex-1 min-h-[24rem] overflow-hidden rounded-lg border border-ink/10">
                    <MapView
                      pins={pins}
                      center={mapCenter}
                      zoom={19}
                      fitToPins
                      fitTrigger={1}
                      interactive={false}
                    />
                  </div>
                  <p className="no-print text-[10px] text-ink/45">
                    Numbered, color-coded markers correspond to the species
                    list. Allow a few seconds for satellite tiles to load
                    before printing.
                  </p>
                </>
              ) : (
                <div className="flex h-full min-h-[24rem] items-center justify-center rounded-lg border border-dashed border-ink/15 text-sm text-ink/50">
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
                        <th className="py-1.5 pr-1 text-right font-medium">
                          Trees
                        </th>
                        <th className="no-print w-6 py-1.5 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {bySpecies.map((row) => {
                        const isConfirming = confirming === row.species_name;
                        return (
                          <tr
                            key={row.species_name}
                            className={
                              "border-b border-ink/5 align-top " +
                              (isConfirming ? "bg-red-50" : "")
                            }
                          >
                            <td className="py-1.5 pr-2">
                              <span
                                className="inline-block h-3 w-3 rounded-full border border-ink/15"
                                style={{ background: row.dominant_color }}
                              />
                            </td>
                            <td
                              className="py-1.5 pr-2 font-medium"
                              colSpan={isConfirming ? 3 : 1}
                            >
                              {isConfirming ? (
                                <div className="no-print flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-red-700">
                                    Delete {row.pin_count} {row.species_name}{" "}
                                    pin{row.pin_count > 1 ? "s" : ""}?
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteSpecies(row.species_name)
                                      }
                                      className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700"
                                    >
                                      Delete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirming(null)}
                                      className="rounded border border-ink/15 bg-paper px-2 py-0.5 text-[11px] text-ink/70 hover:bg-ink/5"
                                    >
                                      Cancel
                                    </button>
                                  </span>
                                </div>
                              ) : (
                                <EditableText
                                  value={row.species_name}
                                  onSave={(next) =>
                                    renameSpecies(row.species_name, next)
                                  }
                                  className="-mx-1 inline-block px-1"
                                  inputClassName="text-xs font-medium"
                                />
                              )}
                            </td>
                            {!isConfirming && (
                              <>
                                <td className="py-1.5 pr-2 text-right tabular-nums">
                                  {row.pin_count}
                                </td>
                                <td className="py-1.5 pr-1 text-right tabular-nums">
                                  {row.tree_count}
                                </td>
                              </>
                            )}
                            <td className="no-print py-1.5 pl-1 text-right">
                              {!isConfirming ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirming(row.species_name)
                                  }
                                  aria-label={`Delete all ${row.species_name} pins`}
                                  className="rounded p-0.5 text-ink/35 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
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

        <footer className="mt-6 border-t border-ink/10 pt-2 text-[10px] text-ink/40">
          Generated {formatLongDate(new Date().toISOString())} ·{" "}
          {totals.totalPins} pins · {totals.totalTrees} trees · zellin.ai
        </footer>
      </article>
    </main>
  );
}
