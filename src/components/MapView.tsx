import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import type { TreePin } from "@/lib/types";

type Props = {
  pins: TreePin[];
  center: [number, number];
  zoom?: number;
  onMapLongPress?: (lat: number, lng: number) => void;
  onPinTap?: (pin: TreePin) => void;
  flyTo?: [number, number] | null;
};

function makeIcon(num: number) {
  return L.divIcon({
    className: "tree-pin-marker",
    html: `<div class="pin">${num}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function MapEvents({
  onLongPress,
  flyTo,
}: {
  onLongPress?: (lat: number, lng: number) => void;
  flyTo?: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, Math.max(map.getZoom(), 19), { duration: 0.6 });
  }, [flyTo, map]);

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
}: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      maxZoom={21}
      zoomControl={false}
      attributionControl
      className="h-full w-full"
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
          icon={makeIcon(p.pin_number)}
          eventHandlers={{
            click: () => onPinTap?.(p),
          }}
        />
      ))}
      <MapEvents onLongPress={onMapLongPress} flyTo={flyTo} />
    </MapContainer>
  );
}
