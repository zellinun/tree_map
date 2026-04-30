import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileText, List, Map as MapIcon, Maximize2 } from "lucide-react";
import type { MapHandle } from "@/components/MapView";
import Header from "@/components/Header";
import MapView from "@/components/MapView";
import Crosshair from "@/components/Crosshair";
import LocateMeButton from "@/components/LocateMeButton";
import SpeciesPicker from "@/components/SpeciesPicker";
import PinSheet, { type PinDraft } from "@/components/PinSheet";
import PinList from "@/components/PinList";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { TreeProject, TreePin, PendingPin } from "@/lib/types";
import { enqueuePin, flushQueue, readQueue } from "@/lib/pinQueue";
import { DEFAULT_PIN_COLOR } from "@/lib/colors";

const DEFAULT_CENTER: [number, number] = [37.9735, -122.5311]; // San Rafael, CA fallback
type View = "map" | "list";

export default function ProjectMapPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id!;

  const [project, setProject] = useState<TreeProject | null>(null);
  const [pins, setPins] = useState<TreePin[]>([]);
  const [pending, setPending] = useState<PendingPin[]>([]);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("map");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activePin, setActivePin] = useState<TreePin | null>(null);
  const [draft, setDraft] = useState<PinDraft | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [lastColor, setLastColor] = useState<string>(DEFAULT_PIN_COLOR);

  const mapRef = useRef<MapHandle | null>(null);

  // Load project + pins, plus any queued offline pins.
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
      const list = (pinData as TreePin[]) ?? [];
      setPins(list);
      setPending(readQueue(projectId));
      if (list.length > 0) {
        const here: [number, number] = [list[0].latitude, list[0].longitude];
        setCenter(here);
        setFlyTo(here);
      }
    })();

    // Always try to center on the user's actual location on entry.
    // MapContainer.center is only the *initial* value, so we drive movement
    // through flyTo (handled by MapEvents inside MapView).
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!active) return;
          const here: [number, number] = [
            pos.coords.latitude,
            pos.coords.longitude,
          ];
          setCenter(here);
          setFlyTo(here);
        },
        () => {
          // permission denied / unavailable: stick with the fallback.
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 }
      );
    }
    return () => {
      active = false;
    };
  }, [projectId]);

  // Try to flush any queued pins on mount.
  useEffect(() => {
    flushQueue(projectId).then((synced) => {
      if (synced.length > 0) {
        setPins((prev) => mergePins(prev, synced));
        setPending(readQueue(projectId));
      }
    });
  }, [projectId]);

  const nextPinNumber = useMemo(() => {
    const fromServer = pins.reduce((m, p) => Math.max(m, p.pin_number), 0);
    const fromPending = pending.reduce(
      (m, p) => Math.max(m, p.pin_number),
      0
    );
    return Math.max(fromServer, fromPending) + 1;
  }, [pins, pending]);

  const allMarkers: TreePin[] = useMemo(() => {
    const pendingAsPins: TreePin[] = pending.map((p) => ({
      id: `pending:${p.client_id}`,
      project_id: p.project_id,
      pin_number: p.pin_number,
      latitude: p.latitude,
      longitude: p.longitude,
      species_name: p.species_name,
      quantity: p.quantity,
      description: p.description,
      color: p.color || DEFAULT_PIN_COLOR,
      photos: [],
      created_at: new Date().toISOString(),
    }));
    return [...pins, ...pendingAsPins].sort(
      (a, b) => a.pin_number - b.pin_number
    );
  }, [pins, pending]);

  const openDraft = useCallback(
    (lat: number, lng: number, preset?: { species: string; color: string }) => {
      setActivePin(null);
      setDraft({
        pin_number: nextPinNumber,
        latitude: lat,
        longitude: lng,
        species_name: preset?.species ?? "",
        quantity: 1,
        description: null,
        color: preset?.color ?? lastColor,
      });
      setSheetOpen(true);
      // Don't flyTo — user just framed the crosshair where they want the pin;
      // re-centering would feel like the map snapping away under them.
    },
    [nextPinNumber, lastColor]
  );


  // Species picker: open the modal
  const handleOpenPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  // Species selected → drop pin at crosshair immediately (no sheet)
  const handleSpeciesSelect = useCallback(
    async (species: string) => {
      const m = mapRef.current;
      if (!m) return;
      const c = m.getCenter();
      if (!c) { setError("Map not ready — try again."); return; }
      await saveDraftDirect({
        pin_number: nextPinNumber,
        latitude: c.lat,
        longitude: c.lng,
        species_name: species,
        quantity: 1,
        description: null,
        color: DEFAULT_PIN_COLOR,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nextPinNumber]
  );

  // "Add new" → open full PinSheet at crosshair
  const handlePickerAddNew = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    const c = m.getCenter();
    if (!c) return;
    openDraft(c.lat, c.lng, { species: "", color: DEFAULT_PIN_COLOR });
  }, [openDraft]);


  // "Locate me" button: use watchPosition to get the best reading.
  // Accept first reading under 30 m accuracy, or best after 5 s.
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);

    let best: GeolocationPosition | null = null;
    let settled = false;

    const settle = () => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      setLocating(false);
      if (best) {
        setFlyTo([best.coords.latitude, best.coords.longitude]);
      } else {
        setError("Could not get current position.");
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (settled) return;
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos;
        }
        if (pos.coords.accuracy <= 30) settle();
      },
      (err) => {
        if (settled) return;
        // If we already have a reading, use it; otherwise report error.
        if (best) {
          settle();
        } else {
          settled = true;
          navigator.geolocation.clearWatch(watchId);
          setLocating(false);
          setError(err.message || "Could not get current position.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
    );

    // Fallback: after 5 s, use whatever we have.
    setTimeout(settle, 5_000);
  }, []);

  const handleSelectPin = useCallback((pin: TreePin) => {
    if (pin.id.startsWith("pending:")) return;
    setActivePin(pin);
    setDraft(null);
    setSheetOpen(true);
    setFlyTo([pin.latitude, pin.longitude]);
  }, []);

  // Direct save — used by species picker (no sheet).
  const saveDraftDirect = async (d: PinDraft) => {
    const row = {
      project_id: projectId,
      pin_number: d.pin_number,
      latitude: d.latitude,
      longitude: d.longitude,
      species_name: d.species_name,
      quantity: d.quantity,
      description: d.description,
      color: d.color,
      photos: [] as string[],
    };
    const { data, error: err } = await supabase
      .from("tree_pins")
      .insert(row)
      .select()
      .single();
    if (err || !data) {
      const clientId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const pendingPin: PendingPin = { ...row, client_id: clientId, pending: true };
      enqueuePin(projectId, pendingPin);
      setPending((prev) => [...prev, pendingPin]);
      return;
    }
    setPins((prev) => mergePins(prev, [data as TreePin]));
  };

  const saveDraft = async (d: PinDraft) => {
    const row = {
      project_id: projectId,
      pin_number: d.pin_number,
      latitude: d.latitude,
      longitude: d.longitude,
      species_name: d.species_name,
      quantity: d.quantity,
      description: d.description,
      color: d.color,
      photos: [],
    };
    setLastColor(d.color);
    const { data, error: err } = await supabase
      .from("tree_pins")
      .insert(row)
      .select()
      .single();
    if (err || !data) {
      // Offline queue fallback.
      const clientId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const pendingPin: PendingPin = {
        ...row,
        client_id: clientId,
        pending: true,
      };
      enqueuePin(projectId, pendingPin);
      setPending((prev) => [...prev, pendingPin]);
      return;
    }
    setPins((prev) => mergePins(prev, [data as TreePin]));
  };

  const updatePin = async (pinId: string, patch: Partial<TreePin>) => {
    if (patch.color) setLastColor(patch.color);
    const { data, error: err } = await supabase
      .from("tree_pins")
      .update(patch)
      .eq("id", pinId)
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "Could not update pin.");
      return;
    }
    setPins((prev) =>
      prev.map((p) => (p.id === pinId ? (data as TreePin) : p))
    );
  };

  const deletePin = async (pinId: string) => {
    const { error: err } = await supabase
      .from("tree_pins")
      .delete()
      .eq("id", pinId);
    if (err) {
      setError(err.message);
      return;
    }
    setPins((prev) => prev.filter((p) => p.id !== pinId));
  };

  const retrySync = async () => {
    const synced = await flushQueue(projectId);
    if (synced.length > 0) {
      setPins((prev) => mergePins(prev, synced));
    }
    setPending(readQueue(projectId));
  };

  // Best-effort retry when tab regains visibility / network reconnects.
  useEffect(() => {
    const onOnline = () => retrySync();
    const onVisible = () => {
      if (document.visibilityState === "visible") retrySync();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <main className="flex h-[100dvh] flex-col bg-paper">
      <Header
        back={{ to: "/", label: "← Properties" }}
        title={project?.name ?? "Loading…"}
        right={
          <div className="flex items-center gap-1">
            {view === "map" && allMarkers.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFitTrigger((t) => t + 1)}
                title="Fit all pins"
              >
                <Maximize2 className="h-4 w-4" />
                Fit all
              </Button>
            ) : null}
            <Button
              variant={view === "map" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("map")}
            >
              <MapIcon className="h-4 w-4" />
              Map
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/p/${projectId}/report`}>
                <FileText className="h-4 w-4" />
                Report
              </Link>
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
          <button
            className="ml-2 underline"
            onClick={() => setError(null)}
          >
            dismiss
          </button>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {pending.length} pin{pending.length > 1 ? "s" : ""} queued offline.
          <button className="ml-2 underline" onClick={retrySync}>
            Sync now
          </button>
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        {view === "map" ? (
          <>
            <div className="absolute inset-0">
              <MapView
                pins={allMarkers}
                center={center}
                onPinTap={handleSelectPin}
                flyTo={flyTo}
                fitToPins={fitTrigger > 0}
                fitTrigger={fitTrigger}
                onMapReady={(m) => {
                  mapRef.current = m;
                }}
              />
            </div>
            {!sheetOpen && <Crosshair />}
            <LocateMeButton onClick={handleLocateMe} loading={locating} />
            <button
                type="button"
                onClick={handleOpenPicker}
                className="absolute bottom-0 right-0 z-[1000] m-4 mb-[max(1rem,env(safe-area-inset-bottom))] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg transition active:scale-95"
                aria-label="Add a new pin"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <SpeciesPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onSelect={handleSpeciesSelect}
                onAddNew={handlePickerAddNew}
              />
          </>
        ) : (
          <div className="h-full overflow-y-auto pb-24">
            <PinList pins={allMarkers} onSelect={handleSelectPin} />
          </div>
        )}
      </div>

      <PinSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        pin={activePin}
        draft={draft}
        onSaveDraft={saveDraft}
        onUpdate={updatePin}
        onDelete={deletePin}
      />
    </main>
  );
}

function mergePins(prev: TreePin[], next: TreePin[]): TreePin[] {
  const byId = new Map(prev.map((p) => [p.id, p]));
  for (const n of next) byId.set(n.id, n);
  return Array.from(byId.values()).sort((a, b) => a.pin_number - b.pin_number);
}
