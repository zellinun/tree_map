import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import type { TreePin } from "@/lib/types";
import { DEFAULT_PIN_COLOR } from "@/lib/colors";

type Props = {
  pins: TreePin[];
  center: [number, number];
  zoom?: number;
  onMapLongPress?: (lat: number, lng: number) => void;
  onPinTap?: (pin: TreePin) => void;
  flyTo?: [number, number] | null;
  fitToPins?: boolean;
  fitTrigger?: number;
  interactive?: boolean;
};

function makeIcon(num: number, color: string) {
  return L.divIcon({
    className: "tree-pin-marker",
    html: `<div class="pin" style="background:${color}"><span>${num}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Linearly scale the pin size with zoom so a zoomed-out property view
// doesn't turn into a wall of overlapping markers.
function zoomScale(zoom: number): number {
  return Math.max(0.4, Math.min(1.2, (zoom - 14) / 5));
}

function syncZoomScale(map: L.Map) {
  const el = map.getContainer();
  el.style.setProperty("--pin-scale", String(zoomScale(map.getZoom())));
}

function MapEvents({
  onLongPress,
  flyTo,
  fitTrigger,
  pins,
  fitToPins,
}: {
  onLongPress?: (lat: number, lng: number) => void;
  flyTo?: [number, number] | null;
  fitTrigger?: number;
  pins: TreePin[];
  fitToPins?: boolean;
}) {
  const map = useMap();

  // Keep the pin scale CSS variable in sync with the current zoom level.
  useEffect(() => {
    syncZoomScale(map);
    const onZoom = () => syncZoomScale(map);
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, Math.max(map.getZoom(), 19), { duration: 0.6 });
  }, [flyTo, map]);

  // Fit-to-pins: triggered on mount when fitToPins=true, or on demand
  // each time `fitTrigger` increments.
  useEffect(() => {
    if (!fitToPins || pins.length === 0) return;
    const bounds = L.latLngBounds(
      pins.map((p) => [p.latitude, p.longitude] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
    // Re-sync scale after the programmatic zoom.
    setTimeout(() => syncZoomScale(map), 320);
  }, [fitTrigger, fitToPins, pins, map]);

  useEffect(() => {
    if (!onLongPress) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startLatLng: L.LatLng | null = null;

    const onDown = (e: L.LeafletMouseEvent) => {
      startLatLng = e.latlng;
      timer = setTimeout(() => {
        if (startLatLng) onLongPress(startLatLng.lat, startLatLng.lng);
      }, 550);
    };
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      startLatLng = null;
    };

    map.on("mousedown", onDown);
    map.on("touchstart", onDown as unknown as L.LeafletEventHandlerFn);
    map.on("mouseup", cancel);
    map.on("mousemove", cancel);
    map.on("touchend", cancel);
    map.on("touchmove", cancel);
    map.on("dragstart", cancel);

    return () => {
      map.off("mousedown", onDown);
      map.off("touchstart", onDown as unknown as L.LeafletEventHandlerFn);
      map.off("mouseup", cancel);
      map.off("mousemove", cancel);
      map.off("touchend", cancel);
      map.off("touchmove", cancel);
      map.off("dragstart", cancel);
    };
  }, [map, onLongPress]);

  return null;
}

export default function MapView({
  pins,
  center,
  zoom = 19,
  onMapLongPress,
  onPinTap,
  flyTo,
  fitToPins,
  fitTrigger,
  interactive = true,
}: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      maxZoom={21}
      zoomControl={false}
      attributionControl
      className="h-full w-full"
      dragging={interactive}
      touchZoom={interactive}
      doubleClickZoom={interactive}
      scrollWheelZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
        maxZoom={21}
      />
      {pins.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={makeIcon(p.pin_number, p.color || DEFAULT_PIN_COLOR)}
          eventHandlers={{
            click: () => onPinTap?.(p),
          }}
        />
      ))}
      <MapEvents
        onLongPress={onMapLongPress}
        flyTo={flyTo}
        fitTrigger={fitTrigger}
        pins={pins}
        fitToPins={fitToPins}
      />
    </MapContainer>
  );
}
