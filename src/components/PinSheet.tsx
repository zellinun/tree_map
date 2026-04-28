import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
import type { TreePin } from "@/lib/types";

export type PinDraft = {
  pin_number: number;
  latitude: number;
  longitude: number;
  species_name: string;
  quantity: number;
  description: string | null;
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
  const [quantity, setQuantity] = useState<number>(1);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pin) {
      setSpecies(pin.species_name ?? "");
      setQuantity(pin.quantity ?? 1);
      setDescription(pin.description ?? "");
    } else if (draft) {
      setSpecies(draft.species_name ?? "");
      setQuantity(draft.quantity ?? 1);
      setDescription(draft.description ?? "");
    } else {
      setSpecies("");
      setQuantity(1);
      setDescription("");
    }
  }, [pin, draft, open]);

  const pinNumber = pin?.pin_number ?? draft?.pin_number ?? 0;
  const lat = pin?.latitude ?? draft?.latitude ?? 0;
  const lng = pin?.longitude ?? draft?.longitude ?? 0;

  const save = async () => {
    setSaving(true);
    try {
      const trimmedSpecies = species.trim() || "Unidentified";
      const cleanQty = Math.max(1, Math.floor(Number(quantity) || 1));
      const cleanDesc = description.trim() ? description.trim() : null;

      if (pin) {
        await onUpdate(pin.id, {
          species_name: trimmedSpecies,
          quantity: cleanQty,
          description: cleanDesc,
        });
      } else if (draft) {
        await onSaveDraft({
          ...draft,
          species_name: trimmedSpecies,
          quantity: cleanQty,
          description: cleanDesc,
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
          <DrawerTitle>
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
              onChange={(e) =>
                setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
            />
            <p className="text-xs text-ink/50">
              Use {">"} 1 when this pin represents a row of identical adjacent
              trees.
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
