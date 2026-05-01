import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TreePin } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { DEFAULT_PIN_COLOR, PIN_COLORS } from "@/lib/colors";
import { compressImage } from "@/lib/imageCompress";

export type PinDraft = {
  pin_number: number;
  latitude: number;
  longitude: number;
  species_name: string;
  quantity: number;
  description: string | null;
  color: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pin: TreePin | null;
  draft: PinDraft | null;
  onSaveDraft: (draft: PinDraft) => Promise<void> | void;
  onUpdate: (id: string, patch: Partial<TreePin>) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
};

export default function PinSheet({
  open,
  onOpenChange,
  pin,
  draft,
  onSaveDraft,
  onUpdate,
  onDelete,
}: Props) {
  const [species, setSpecies] = useState("");
  // String-typed so the user can clear the field while typing.
  const [quantity, setQuantity] = useState<string>("1");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_PIN_COLOR);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pin) {
      setSpecies(pin.species_name ?? "");
      setQuantity(String(pin.quantity ?? 1));
      setDescription(pin.description ?? "");
      setColor(pin.color || DEFAULT_PIN_COLOR);
      setPhotos(pin.photos ?? []);
    } else if (draft) {
      setSpecies(draft.species_name ?? "");
      setQuantity(String(draft.quantity ?? 1));
      setDescription(draft.description ?? "");
      setColor(draft.color || DEFAULT_PIN_COLOR);
      setPhotos([]);
    } else {
      setSpecies("");
      setQuantity("1");
      setDescription("");
      setColor(DEFAULT_PIN_COLOR);
      setPhotos([]);
    }
  }, [pin, draft, open]);

  const pinNumber = pin?.pin_number ?? draft?.pin_number ?? 0;
  const lat = pin?.latitude ?? draft?.latitude ?? 0;
  const lng = pin?.longitude ?? draft?.longitude ?? 0;

  const cleanQuantity = (raw: string): number => {
    if (raw.trim() === "") return 1;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 1) return 1;
    return n;
  };

  const projectId = pin?.project_id ?? "";
  const pinId = pin?.id ?? "";

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pinId) return;
    setUploading(true);
    setPhotoError(null);
    try {
      // Compress before upload — iPhone photos are routinely 3-5 MB; this
      // typically gets them under 400 KB and turns a 15s wait into a 2s one.
      let blob: Blob = file;
      try {
        blob = await compressImage(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.85,
        });
      } catch (compressErr) {
        // Compression failure is non-fatal — fall through with the
        // original file so the user still gets a chance.
        console.warn("Photo compression failed; uploading original.", compressErr);
      }

      const uuid = crypto.randomUUID();
      // After compression the bytes are JPEG; use .jpg uniformly so the
      // bucket sees a consistent content type.
      const ext = blob === file
        ? (file.name.split(".").pop() || "jpg").toLowerCase()
        : "jpg";
      const path = `${projectId}/${pinId}/${uuid}.${ext}`;
      const contentType =
        blob === file ? file.type || "image/jpeg" : "image/jpeg";
      const { error: uploadErr } = await supabase.storage
        .from("tree_photos")
        .upload(path, blob, {
          contentType,
          upsert: false,
        });
      if (uploadErr) {
        // Surface the full Supabase error in the console for diagnosis.
        console.error("Photo upload failed:", uploadErr);
        throw uploadErr;
      }
      const { data: urlData } = supabase.storage
        .from("tree_photos")
        .getPublicUrl(path);
      if (!urlData?.publicUrl) {
        throw new Error("Could not resolve photo URL.");
      }
      const newPhotos = [...photos, urlData.publicUrl];
      setPhotos(newPhotos);
      await onUpdate(pinId, { photos: newPhotos });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Photo upload failed. Check your connection.";
      setPhotoError(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = async (url: string) => {
    if (!pinId) return;
    const newPhotos = photos.filter((p) => p !== url);
    setPhotos(newPhotos);
    await onUpdate(pinId, { photos: newPhotos });
  };

  const save = async () => {
    setSaving(true);
    try {
      const trimmedSpecies = species.trim() || "Unidentified";
      const cleanQty = cleanQuantity(quantity);
      const cleanDesc = description.trim() ? description.trim() : null;

      if (pin) {
        await onUpdate(pin.id, {
          species_name: trimmedSpecies,
          quantity: cleanQty,
          description: cleanDesc,
          color,
        });
      } else if (draft) {
        await onSaveDraft({
          ...draft,
          species_name: trimmedSpecies,
          quantity: cleanQty,
          description: cleanDesc,
          color,
        });
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!pin) {
      onOpenChange(false);
      return;
    }
    await onDelete(pin.id);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 rounded-full border border-ink/15"
              style={{ background: color }}
              aria-hidden="true"
            />
            {pin ? `Pin #${pinNumber}` : `New pin · #${pinNumber}`}
          </DrawerTitle>
          <DrawerDescription>
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 px-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="species">Species</Label>
            <Input
              id="species"
              autoFocus
              placeholder="Coast Live Oak"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              autoCapitalize="words"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              inputMode="numeric"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onBlur={() => setQuantity(String(cleanQuantity(quantity)))}
            />
            <p className="text-xs text-ink/50">
              Use {">"} 1 when this pin represents a row of identical adjacent
              trees.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PIN_COLORS.map((c) => {
                const active = color.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    className={cn(
                      "relative h-10 w-10 rounded-full border-2 transition active:scale-95",
                      active
                        ? "border-ink ring-2 ring-ink/15 ring-offset-1"
                        : "border-ink/10"
                    )}
                    style={{ background: c.hex }}
                    aria-label={c.name}
                    aria-pressed={active}
                    title={c.name}
                  />
                );
              })}
            </div>
            <p className="text-xs text-ink/50">
              Group similar trees by color. The report shows a color legend.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              placeholder="Health, condition, notes…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {pin && (
            <div className="space-y-2">
              <Label>Photos</Label>
              <div className="flex flex-wrap gap-2">
                {photos.map((url) => (
                  <div key={url} className="relative h-16 w-16">
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full rounded-md border border-ink/10 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-1 h-4 w-4" />
                {uploading ? "Uploading…" : "Add Photo"}
              </Button>
              {photoError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  <p className="font-medium">{photoError}</p>
                  {photoError.toLowerCase().includes("bucket") ||
                  photoError.toLowerCase().includes("not found") ? (
                    <p className="mt-1 text-red-700/85">
                      Fix it once: open your Supabase project →{" "}
                      <strong>Storage</strong> → <strong>New bucket</strong>{" "}
                      → name <code>tree_photos</code> → toggle{" "}
                      <strong>Public</strong> on → <strong>Save</strong>.
                      Then refresh this page.
                    </p>
                  ) : photoError.toLowerCase().includes("policy") ||
                    photoError
                      .toLowerCase()
                      .includes("violates row-level security") ? (
                    <p className="mt-1 text-red-700/85">
                      The bucket exists but isn&rsquo;t accepting uploads.
                      In the Supabase SQL editor, re-run the storage
                      policies block at the bottom of{" "}
                      <code>supabase/schema.sql</code>.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
        <DrawerFooter>
          <Button
            variant="accent"
            size="lg"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          {pin ? (
            <Button
              variant="ghost"
              onClick={del}
              className="text-red-600 hover:bg-red-600/5"
            >
              <Trash2 className="h-4 w-4" />
              Delete pin
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
