import { memo, useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import type { TreePin } from "@/lib/types";
import { DEFAULT_PIN_COLOR } from "@/lib/colors";
import { displayColor } from "@/lib/species";
import {
  GOOGLE_MAPS_KEY,
  GOOGLE_MAPS_LIBRARIES,
} from "@/lib/googleMaps";
import UserMarker from "@/components/UserMarker";

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

function pinSizeForZoom(zoom: number): number {
  if (zoom >= 19) return 18;
  if (zoom >= 17) return 22;
  if (zoom >= 15) return 26;
  return 30;
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
  userMarker?: { lat: number; lng: number; heading: number | null } | null;
};

const PinMarker = memo(function PinMarker({
  pin,
  size,
  onClick,
}: {
  pin: TreePin;
  size: number;
  onClick?: (pin: TreePin) => void;
}) {
  const color = displayColor(pin.color || DEFAULT_PIN_COLOR, pin.species_name);
  const fontSize = Math.round(size * 0.55);
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
          // Heavier white ring + black hairline outline so pins stay
          // crisp over both bright pavement and dark canopy.
          border: "3px solid #fff",
          outline: "1px solid rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize,
          textShadow: "0 1px 2px rgba(0,0,0,0.55)",
          cursor: onClick ? "pointer" : "default",
          boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
          userSelect: "none",
          transition: "width 0.15s, height 0.15s, font-size 0.15s",
        }}
      >
        {pin.pin_number}
      </div>
    </OverlayView>
  );
});

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
  userMarker,
}: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  // The map instance also lives in state so effects that depend on it
  // (flyTo, fitToPins) re-run once it's ready, regardless of whether the
  // pins or the Maps SDK arrived first. Without this, a fit-bounds effect
  // that depended on `mapRef.current` would silently bail when the report
  // page mounted before pins finished loading.
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const prevFitTrigger = useRef<number | undefined>(undefined);
  const [pinSize, setPinSize] = useState(() => pinSizeForZoom(zoom));
  const [mapCenter] = useState<google.maps.LatLngLiteral>({
    lat: center[0],
    lng: center[1],
  });

  // flyTo: pan + zoom when a pin is placed
  useEffect(() => {
    if (flyTo && mapInstance) {
      mapInstance.panTo({ lat: flyTo[0], lng: flyTo[1] });
      const current = mapInstance.getZoom() ?? zoom;
      if (current < 19) mapInstance.setZoom(19);
    }
  }, [flyTo, zoom, mapInstance]);

  // fitTrigger: fit bounds to all pins when triggered. Defers the actual
  // fitBounds call to the next animation frame so the map's container has
  // its final dimensions (the report grid stretches to fit the species
  // table — fitBounds called against a 0-height container would silently
  // fall back to the initial zoom).
  useEffect(() => {
    const map = mapInstance;
    if (!fitToPins || pins.length === 0 || !map) return;
    if (prevFitTrigger.current === fitTrigger && fitTrigger !== undefined) return;
    prevFitTrigger.current = fitTrigger;

    const bounds = new google.maps.LatLngBounds();
    pins.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));

    const fit = () => map.fitBounds(bounds, 40);
    const id = requestAnimationFrame(fit);
    // Also fit on the first 'idle' so we get a clean zoom after Google
    // has finished its own initial layout pass.
    const idleHandle = google.maps.event.addListenerOnce(map, "idle", fit);
    return () => {
      cancelAnimationFrame(id);
      google.maps.event.removeListener(idleHandle);
    };
  }, [fitTrigger, fitToPins, pins, mapInstance]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      setMapInstance(map);

      // Zoom-responsive marker sizing
      map.addListener("zoom_changed", () => {
        const z = map.getZoom() ?? zoom;
        setPinSize(pinSizeForZoom(z));
      });
      setPinSize(pinSizeForZoom(map.getZoom() ?? zoom));

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
    setMapInstance(null);
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
        // Pinch-zoom and double-tap still work on touch; the on-screen
        // controls would otherwise overlap the bottom-right + button.
        zoomControl: false,
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
          size={pinSize}
          onClick={onPinTap}
        />
      ))}
      {userMarker ? (
        <UserMarker
          lat={userMarker.lat}
          lng={userMarker.lng}
          heading={userMarker.heading}
        />
      ) : null}
    </GoogleMap>
  );
}
