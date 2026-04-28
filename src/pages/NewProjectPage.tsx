import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import type { TreeProject } from "@/lib/types";

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <Input
            id="address"
            placeholder="123 Oak Ln, San Rafael, CA"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoCapitalize="words"
          />
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
