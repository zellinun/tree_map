import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-between p-6">
      <header className="flex items-center gap-2 pt-4">
        <TreePine className="h-6 w-6 text-accent" />
        <span className="text-base font-semibold tracking-tight">
          Higuera Tree Care
        </span>
      </header>

      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Walk. Tap. Map.
          </h1>
          <p className="text-ink/60">
            Sign in with your email to start a new property walk-through.
          </p>
        </div>

        {sent ? (
          <div className="space-y-2 rounded-lg border border-ink/10 bg-ink/5 p-4">
            <div className="text-sm font-semibold">Check your email</div>
            <p className="text-sm text-ink/70">
              We sent a magic link to <strong>{email}</strong>. Tap the link on
              this device to log in.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@higueratreecare.com"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full"
              disabled={loading || !email}
            >
              {loading ? "Sending…" : "Send magic link"}
            </Button>
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}
          </form>
        )}
      </section>

      <footer className="pb-2 text-xs text-ink/40">
        zellin.ai · A Higuera Tree Care tool
      </footer>
    </main>
  );
}
