"use client";

import { Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ emailRedirectTo }: { emailRedirectTo: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage("Te hemos enviado un enlace mágico a tu email. Haz clic en él para entrar.");
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <Card className="w-full max-w-md border-stone-200 shadow-card-hero">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-emerald-700 text-base font-bold text-white">
            R
          </div>
          <CardTitle className="text-xl font-semibold text-stone-900">Accede a Recepia</CardTitle>
          <CardDescription>
            Gestiona la recepción y la agenda de tu clínica veterinaria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="h-10 w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Enviando…" : "Enviar enlace de acceso"}
            </Button>
            {message && (
              <p
                aria-live="polite"
                className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                No hemos podido enviar el enlace. Comprueba el email y vuelve a intentarlo.
              </p>
            )}
          </form>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-stone-400">
            <LockKeyhole className="size-3.5" /> Acceso seguro sin contraseña
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
