import Link from "next/link";

export default function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link className="flex items-center gap-3 font-semibold text-stone-950" href="/login">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              R
            </span>
            Recepia
          </Link>
          <span className="text-sm text-stone-500">Recepción veterinaria con IA</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <article className="rounded-2xl border border-stone-200 bg-white px-6 py-8 shadow-sm sm:px-10">
          {children}
        </article>
      </main>
      <footer className="mx-auto flex max-w-4xl flex-wrap gap-x-5 gap-y-2 px-6 pb-12 text-sm text-stone-500">
        <Link href="/privacidad">Privacidad</Link>
        <Link href="/terminos">Condiciones</Link>
        <Link href="/eliminacion-de-datos">Eliminación de datos</Link>
        <Link href="/aviso-legal">Aviso legal</Link>
      </footer>
    </div>
  );
}
