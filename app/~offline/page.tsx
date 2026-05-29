/**
 * Fallback cuando la app está offline.
 * Serwist sirve esta ruta desde cache cuando no hay red.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        Sin conexión
      </h1>
      <p className="text-muted-foreground">
        No hay conexión a internet. Revisá tu red e intentá de nuevo.
      </p>
      <a
        href="/"
        className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Volver al inicio
      </a>
    </div>
  );
}
