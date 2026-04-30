import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import type { TreeProject } from "@/lib/types";
import { GOOGLE_MAPS_KEY, GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMaps";

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  // Captured when the user picks a Place suggestion. If they hand-type and
  // never pick a suggestion, this stays null and the project just stores
  // text — falls back to GPS / first-pin centering on map open.
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const onAcLoad = (ac: google.maps.places.Autocomplete) => {
    acRef.current = ac;
  };

  const onPlaceChanged = () => {
    const place = acRef.current?.getPlace();
    if (!place) return;
    const loc = place.geometry?.location;
    if (loc) setLatLng({ lat: loc.lat(), lng: loc.lng() });
    if (place.formatted_address) setAddress(place.formatted_address);
    else if (place.name) setAddress(place.name);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }

    const { data, error: err } = await supabase
      .from("tree_projects")
      .insert({
        user_id: userId,
        name: name.trim(),
        address: address.trim() || null,
        description: description.trim() || null,
        latitude: latLng?.lat ?? null,
        longitude: latLng?.lng ?? null,
      })
      .select()
      .single();

    setSaving(false);
    if (err || !data) {
      setError(err?.message ?? "Could not create project.");
      return;
    }
    const project = data as TreeProject;
    navigate(`/p/${project.id}`, { replace: true });
  }

  // The address field uses Google Places Autocomplete when the SDK is
  // loaded; before that, it falls back to a plain input so the form
  // is still functional offline.
  const addressField = (
    <Input
      id="address"
      placeholder="Start typing an address…"
      value={address}
      onChange={(e) => {
        setAddress(e.target.value);
        // If the user edits after picking, drop the captured coords;
        // they're picking again or going free-form.
        if (latLng) setLatLng(null);
      }}
      autoCapitalize="words"
      autoCorrect="off"
      spellCheck={false}
    />
  );

  return (
    <main className="min-h-screen bg-paper">
      <Header back={{ to: "/", label: "← Properties" }} title="New property" />
      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-6"
      >
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Start a walk-through
          </h1>
          <p className="text-sm text-ink/60">
            One property per project. You can edit details later.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Property name</Label>
          <Input
            id="name"
            placeholder="Smith Residence"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            autoCapitalize="words"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          {isLoaded ? (
            <Autocomplete
              onLoad={onAcLoad}
              onPlaceChanged={onPlaceChanged}
              options={{
                fields: ["geometry.location", "formatted_address", "name"],
                types: ["geocode"],
              }}
            >
              {addressField}
            </Autocomplete>
          ) : (
            addressField
          )}
          <p className="text-xs text-ink/50">
            Pick a suggestion to save coordinates so the map opens centered
            on the property.
            {latLng ? (
              <span className="ml-1 font-medium text-accent">
                Address pinned ✓
              </span>
            ) : null}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Notes</Label>
          <Textarea
            id="desc"
            placeholder="Reason for the walk-through, scope, points of contact…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={saving || !name.trim()}
        >
          {saving ? "Creating…" : "Create & start walking"}
        </Button>
      </form>
    </main>
  );
}
