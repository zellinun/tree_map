import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileText, List, Map as MapIcon, Maximize2 } from "lucide-react";
import Header from "@/components/Header";
import MapView, { type MapHandle } from "@/components/MapView";
import AddressSearch from "@/components/AddressSearch";
import Crosshair from "@/components/Crosshair";
import LocateMeButton from "@/components/LocateMeButton";
import NewPinButton from "@/components/NewPinButton";
import SpeciesPicker from "@/components/SpeciesPicker";
import PinSheet, { type PinDraft } from "@/components/PinSheet";
import PinList from "@/components/PinList";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { TreeProject, TreePin, PendingPin } from "@/lib/types";
import { enqueuePin, flushQueue, readQueue } from "@/lib/pinQueue";
import { DEFAULT_PIN_COLOR } from "@/lib/colors";
import { colorForSpecies } from "@/lib/species";
import { preciseLocate } from "@/lib/geolocation";
import {
  watchUserPosition,
  watchHeading,
  requestOrientationPermission,
  type UserPosition,
} from "@/lib/userTracking";

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
  const [activePin, setActivePin] = useState<TreePin | null>(null);
  const [draft, setDraft] = useState<PinDraft | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [userPos, setUserPos] = useState<UserPosition | null>(null);
  const [heading, setHeading] = useState<number | null>(null);

  const mapRef = useRef<MapHandle | null>(null);
  const headingStopRef = useRef<(() => void) | null>(null);

  // Stable callback so MapView's memoized children don't see a new
  // function reference on every parent re-render.
  const onMapReady = useCallback((m: MapHandle) => {
    mapRef.current = m;
  }, []);

  // Stable userMarker reference: only allocate a new object when the
  // throttled position or heading actually changes.
  const userMarkerProp = useMemo(
    () => (userPos ? { ...userPos, heading } : null),
    [userPos, heading]
  );

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
    // through flyTo (handled by MapEvents inside MapView). We use
    // preciseLocate so we don't snap to a coarse cellular fix.
    preciseLocate({ targetAccuracy: 25, maxWait: 12_000 })
      .then((pos) => {
        if (!active) return;
        const here: [number, number] = [
          pos.coords.latitude,
          pos.coords.longitude,
        ];
        setCenter(here);
        setFlyTo(here);
        setAccuracy(pos.coords.accuracy);
      })
      .catch(() => {
        // Permission denied / unavailable / timed out: stick with fallback.
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  // Continuously track the user's position so the live "you are here" arrow
  // updates as they walk. No iOS permission prompt is needed for geolocation
  // beyond the initial grant; orientation is gated separately on the
  // Locate Me tap because iOS requires a user gesture for that API.
  useEffect(() => {
    const stop = watchUserPosition(
      (p) => setUserPos(p),
      () => {
        // Permission denied / unavailable: marker just stays hidden.
      }
    );
    return stop;
  }, []);

  // Stop the heading listener on unmount.
  useEffect(() => {
    return () => {
      headingStopRef.current?.();
      headingStopRef.current = null;
    };
  }, []);

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
      photos: p.photos ?? [],
      created_at: new Date().toISOString(),
    }));
    return [...pins, ...pendingAsPins].sort(
      (a, b) => a.pin_number - b.pin_number
    );
  }, [pins, pending]);

  // 2-click flow: tap +, tap a species. The pin drops at the crosshair
  // immediately; no edit drawer pops up. The user can tap the marker
  // afterward to edit description/quantity/color if they want.
  const insertPinAtCrosshair = useCallback(
    async (species: string) => {
      const m = mapRef.current;
      if (!m) {
        setError("Map not ready yet — try again in a second.");
        return;
      }
      const c = m.getCenter();
      if (!c) {
        setError("Map center isn't available yet — try again in a second.");
        return;
      }
      const color = colorForSpecies(species);
      const row = {
        project_id: projectId,
        pin_number: nextPinNumber,
        latitude: c.lat,
        longitude: c.lng,
        species_name: species,
        quantity: 1,
        description: null,
        color,
        photos: [] as string[],
      };
      const { data, error: err } = await supabase
        .from("tree_pins")
        .insert(row)
        .select()
        .single();
      if (err || !data) {
        // Offline queue fallback (mirrors saveDraft).
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
    },
    [projectId, nextPinNumber]
  );

  const handlePickSpecies = useCallback(
    (species: string) => {
      setPickerOpen(false);
      // Fire and forget — failures are queued offline.
      void insertPinAtCrosshair(species);
    },
    [insertPinAtCrosshair]
  );

  // "Locate me" button: recenter the map on the user's current GPS position.
  // Uses preciseLocate which watches GPS until accuracy settles or a timeout.
  // Also opts into the device-orientation listener — this has to happen
  // inside a user gesture on iOS (Safari requires it for the permission API).
  const handleLocateMe = useCallback(async () => {
    setLocating(true);
    setAccuracy(null);

    // Request orientation permission alongside the locate. If granted,
    // start the heading watcher — the live arrow will rotate as the user
    // turns. Idempotent: if we've already started one, skip.
    if (!headingStopRef.current) {
      const granted = await requestOrientationPermission();
      if (granted) {
        headingStopRef.current = watchHeading(setHeading);
      }
    }

    try {
      const pos = await preciseLocate({
        targetAccuracy: 15,
        maxWait: 15_000,
        onUpdate: (p) => setAccuracy(p.coords.accuracy),
      });
      setFlyTo([pos.coords.latitude, pos.coords.longitude]);
      setAccuracy(pos.coords.accuracy);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not get current position.";
      setError(message);
    } finally {
      setLocating(false);
    }
  }, []);

  const handleSelectPin = useCallback((pin: TreePin) => {
    if (pin.id.startsWith("pending:")) return;
    setActivePin(pin);
    setDraft(null);
    setSheetOpen(true);
    setFlyTo([pin.latitude, pin.longitude]);
  }, []);

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
      photos: [] as string[],
    };
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

  // Auto-clear the accuracy chip a few seconds after it settles.
  useEffect(() => {
    if (accuracy === null || locating) return;
    const t = setTimeout(() => setAccuracy(null), 6_000);
    return () => clearTimeout(t);
  }, [accuracy, locating]);

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
                aria-label="Fit all pins"
              >
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Fit all</span>
              </Button>
            ) : null}
            <Button
              variant={view === "map" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("map")}
              aria-label="Map view"
            >
              <MapIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Map</span>
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button asChild variant="outline" size="sm" aria-label="Report">
              <Link to={`/p/${projectId}/report`}>
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Report</span>
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
                onMapReady={onMapReady}
                userMarker={userMarkerProp}
              />
            </div>
            {/* Crosshair is the "where will the next pin drop" indicator —
                hide it whenever a drawer is up so it doesn't overlap the
                drawer content or the pin the user is editing. */}
            {!sheetOpen && !pickerOpen ? <Crosshair /> : null}
            <AddressSearch onSelect={(p) => setFlyTo([p.lat, p.lng])} />
            {accuracy !== null || locating ? (
              <div className="pointer-events-none absolute left-1/2 top-16 z-[850] -translate-x-1/2 sm:top-[68px]">
                <div
                  className={
                    "rounded-full border bg-paper/95 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur " +
                    (locating
                      ? "border-ink/15 text-ink/70"
                      : accuracy !== null && accuracy <= 25
                      ? "border-accent/40 text-accent"
                      : "border-amber-300 text-amber-700")
                  }
                >
                  {locating
                    ? accuracy !== null
                      ? `Searching… ±${Math.round(accuracy)} m`
                      : "Searching for GPS…"
                    : `±${Math.round(accuracy ?? 0)} m`}
                  {!locating && accuracy !== null && accuracy > 50 ? (
                    <span className="ml-2 text-amber-700/80">
                      step outside for a tighter fix
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            <LocateMeButton onClick={handleLocateMe} loading={locating} />
            <NewPinButton onClick={() => setPickerOpen(true)} />
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

      <SpeciesPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handlePickSpecies}
      />
    </main>
  );
}

function mergePins(prev: TreePin[], next: TreePin[]): TreePin[] {
  const byId = new Map(prev.map((p) => [p.id, p]));
  for (const n of next) byId.set(n.id, n);
  return Array.from(byId.values()).sort((a, b) => a.pin_number - b.pin_number);
}
