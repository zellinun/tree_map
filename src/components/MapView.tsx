import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import type { TreePin } from "@/lib/types";
import { DEFAULT_PIN_COLOR } from "@/lib/colors";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

function zoomScale(zoom: number): number {
  return Math.max(0.4, Math.min(1.2, (zoom - 14) / 5));
}

// Adapter so ProjectMapPage can call map.getCenter() / map.getZoom()
// using a Leaflet-compatible interface (only what's actually used).
export type MapHandle = {
  getCenter(): { lat: number; lng: number } | null;
  getZoom(): number;
};

type Props = {
  pins: TreePin[];
  center: [number, number];
  zoom?: number;
  onPinTap?: (pin: TreePin) => void;
  flyTo?: [number, number] | null;
  fitToPins?: boolean;
  fitTrigger?: number;
  interactive?: boolean;
  onMapReady?: (map: MapHandle) => void;
};

function PinMarker({
  pin,
  scale,
  onClick,
}: {
  pin: TreePin;
  scale: number;
  onClick?: (pin: TreePin) => void;
}) {
  const color = pin.color || DEFAULT_PIN_COLOR;
  const size = Math.round(32 * scale);
  const fontSize = Math.round(13 * scale);
  return (
    <OverlayView
      position={{ lat: pin.latitude, lng: pin.longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        onClick={() => onClick?.(pin)}
        style={{
          transform: "translate(-50%, -50%)",
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          border: `${Math.max(1.5, 2 * scale)}px solid #fff`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: fontSize,
          cursor: onClick ? "pointer" : "default",
          boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
          userSelect: "none",
          transition: "width 0.15s, height 0.15s, font-size 0.15s",
        }}
      >
        {pin.pin_number}
      </div>
    </OverlayView>
  );
}

export default function MapView({
  pins,
  center,
  zoom = 19,
  onPinTap,
  flyTo,
  fitToPins,
  fitTrigger,
  interactive = true,
  onMapReady,
}: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const prevFitTrigger = useRef<number | undefined>(undefined);
  const [pinScale, setPinScale] = useState(1);
  const [mapCenter] = useState<google.maps.LatLngLiteral>({
    lat: center[0],
    lng: center[1],
  });

  // flyTo: pan + zoom when a pin is placed
  useEffect(() => {
    if (flyTo && mapRef.current) {
      mapRef.current.panTo({ lat: flyTo[0], lng: flyTo[1] });
      const current = mapRef.current.getZoom() ?? zoom;
      if (current < 19) mapRef.current.setZoom(19);
    }
  }, [flyTo, zoom]);

  // fitTrigger: fit bounds to all pins when triggered
  useEffect(() => {
    if (!fitToPins || pins.length === 0 || !mapRef.current) return;
    if (prevFitTrigger.current === fitTrigger && fitTrigger !== undefined) return;
    prevFitTrigger.current = fitTrigger;
    const bounds = new google.maps.LatLngBounds();
    pins.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    mapRef.current.fitBounds(bounds, 40);
  }, [fitTrigger, fitToPins, pins]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      // Zoom-responsive marker sizing
      map.addListener("zoom_changed", () => {
        const z = map.getZoom() ?? zoom;
        setPinScale(zoomScale(z));
      });
      setPinScale(zoomScale(map.getZoom() ?? zoom));

      // Non-interactive mode for report embed
      if (!interactive) {
        map.setOptions({
          draggable: false,
          zoomControl: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          gestureHandling: "none",
        });
      }

      // Expose a handle so ProjectMapPage can read center/zoom
      // (used by crosshair-based pin drop in NewPinSpeedDial flow)
      if (onMapReady) {
        const handle: MapHandle = {
          getCenter() {
            const c = map.getCenter();
            if (!c) return null;
            return { lat: c.lat(), lng: c.lng() };
          },
          getZoom() {
            return map.getZoom() ?? 19;
          },
        };
        onMapReady(handle);
      }
    },
    [interactive, onMapReady, zoom]
  );

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        Failed to load Google Maps
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Loading map…
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={mapCenter}
      zoom={zoom}
      options={{
        mapTypeId: "satellite",
        tilt: 0,
        disableDefaultUI: true,
        zoomControl: interactive,
        gestureHandling: interactive ? "greedy" : "none",
        clickableIcons: false,
      }}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {pins.map((pin) => (
        <PinMarker
          key={pin.id}
          pin={pin}
          scale={pinScale}
          onClick={onPinTap}
        />
      ))}
    </GoogleMap>
  );
}
