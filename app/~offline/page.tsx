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
      {/*
        `<a>` y no `<Link>` a propósito: acá el punto es forzar una navegación
        real contra la red — que es el reintento que la pantalla ofrece. Un
        `<Link>` haría una transición de cliente que no prueba que haya vuelto
        la conexión. La regla está equivocada en este caso, no el código.
      */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- reintento de red: la navegación tiene que ser real, no del router */}
      <a
        href="/"
        className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Volver al inicio
      </a>
    </div>
  );
}
