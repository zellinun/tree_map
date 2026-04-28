import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileText, List, Map as MapIcon, Maximize2 } from "lucide-react";
import Header from "@/components/Header";
import MapView from "@/components/MapView";
import PinHereButton from "@/components/PinHereButton";
import PinSheet, { type PinDraft } from "@/components/PinSheet";
import PinList from "@/components/PinList";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { TreeProject, TreePin, PendingPin } from "@/lib/types";
import { enqueuePin, flushQueue, readQueue } from "@/lib/pinQueue";
import { DEFAULT_PIN_COLOR } from "@/lib/colors";

const DEFAULT_CENTER: [number, number] = [37.9735, -122.5311]; // San Rafael, CA fallback
const PIN_HIGH_ACCURACY: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 15_000,
};

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
  const [lastColor, setLastColor] = useState<string>(DEFAULT_PIN_COLOR);

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
      created_at: new Date().toISOString(),
    }));
    return [...pins, ...pendingAsPins].sort(
      (a, b) => a.pin_number - b.pin_number
    );
  }, [pins, pending]);

  const openDraft = useCallback(
    (lat: number, lng: number) => {
      setActivePin(null);
      setDraft({
        pin_number: nextPinNumber,
        latitude: lat,
        longitude: lng,
        species_name: "",
        quantity: 1,
        description: null,
        color: lastColor,
      });
      setSheetOpen(true);
      setFlyTo([lat, lng]);
    },
    [nextPinNumber, lastColor]
  );

  const handlePinHere = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        openDraft(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        setError(err.message || "Could not get current position.");
      },
      PIN_HIGH_ACCURACY
    );
  };

  const handleMapLongPress = useCallback(
    (lat: number, lng: number) => openDraft(lat, lng),
    [openDraft]
  );

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
                onMapLongPress={handleMapLongPress}
                onPinTap={handleSelectPin}
                flyTo={flyTo}
                fitToPins={fitTrigger > 0}
                fitTrigger={fitTrigger}
              />
            </div>
            <PinHereButton onClick={handlePinHere} loading={locating} />
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
