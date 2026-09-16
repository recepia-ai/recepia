export default function AppLoading() {
  return (
    <div
      className="mx-auto max-w-6xl animate-pulse space-y-6"
      role="status"
      aria-label="Cargando contenido"
    >
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-stone-200" />
        <div className="h-4 w-80 max-w-full rounded bg-stone-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["conversaciones", "citas", "atencion", "clientes"].map((metric) => (
          <div key={metric} className="h-32 rounded-xl border border-stone-200 bg-white" />
        ))}
      </div>
      <div className="h-80 rounded-xl border border-stone-200 bg-white" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
