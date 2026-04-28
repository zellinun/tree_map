import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, MapPinned, LogOut } from "lucide-react";
import Header from "@/components/Header";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { TreeProject } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function ProjectListPage() {
  const [projects, setProjects] = useState<TreeProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("tree_projects")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(err.message);
        setProjects((data as TreeProject[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/login");
  };

  return (
    <main className="min-h-screen bg-paper">
      <Header
        right={
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
            <p className="text-sm text-ink/60">
              Your tree mapping walks, newest first.
            </p>
          </div>
          <Button asChild variant="accent" size="lg">
            <Link to="/new">
              <Plus className="h-4 w-4" />
              New
            </Link>
          </Button>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {projects === null ? (
          <p className="text-sm text-ink/40">Loading…</p>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<MapPinned className="h-8 w-8" />}
            title="No properties yet"
            description="Start your first walk-through. Each property becomes a printable client report."
            action={
              <Button asChild variant="accent">
                <Link to="/new">
                  <Plus className="h-4 w-4" />
                  Start a walk-through
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/p/${p.id}`}
                  className="block rounded-lg border border-ink/10 bg-paper p-4 shadow-sm transition hover:border-ink/25"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-base font-semibold tracking-tight">
                      {p.name}
                    </div>
                    <div className="shrink-0 text-xs text-ink/50">
                      {formatDate(p.created_at)}
                    </div>
                  </div>
                  {p.address ? (
                    <div className="mt-0.5 truncate text-sm text-ink/60">
                      {p.address}
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
