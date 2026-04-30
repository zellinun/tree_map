import { useRef, useState } from "react";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { Search, X } from "lucide-react";
import {
  GOOGLE_MAPS_KEY,
  GOOGLE_MAPS_LIBRARIES,
} from "@/lib/googleMaps";

type Props = {
  onSelect: (place: { lat: number; lng: number; label: string }) => void;
};

// Floating address search at the top of the map view. Uses Google Places
// Autocomplete; on pick, hands the lat/lng up so ProjectMapPage can fly
// the map. The Places dropdown (`pac-container`) is portaled to <body>
// by the Maps SDK; index.css bumps its z-index above the map controls.
export default function AddressSearch({ onSelect }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");

  const onLoad = (ac: google.maps.places.Autocomplete) => {
    acRef.current = ac;
  };

  const onPlaceChanged = () => {
    const ac = acRef.current;
    if (!ac) return;
    const place = ac.getPlace();
    const loc = place.geometry?.location;
    if (!loc) return;
    const lat = loc.lat();
    const lng = loc.lng();
    const label = place.formatted_address || place.name || "";
    setValue(label);
    onSelect({ lat, lng, label });
    // Drop focus so the keyboard collapses on iOS after picking.
    inputRef.current?.blur();
  };

  const clear = () => {
    setValue("");
    inputRef.current?.focus();
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-[860] flex justify-center px-2 sm:top-3 sm:px-3">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-full border border-ink/10 bg-paper/95 px-3 py-2 shadow-md backdrop-blur">
        <Search className="h-4 w-4 shrink-0 text-ink/50" aria-hidden="true" />
        <Autocomplete
          onLoad={onLoad}
          onPlaceChanged={onPlaceChanged}
          options={{
            fields: ["geometry.location", "formatted_address", "name"],
            types: ["geocode"],
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search an address…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/45"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="search"
          />
        </Autocomplete>
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="rounded-full p-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
