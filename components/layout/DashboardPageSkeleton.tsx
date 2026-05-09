import { cn } from "@/lib/utils";

type Variant = "detail" | "list" | "form";

type Props = {
  variant?: Variant;
  className?: string;
};

function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-muted/80 dark:bg-muted/50",
        className,
      )}
    />
  );
}

/** Skeleton de pantalla completa para móvil (lista inspección, detalle, formulario). */
export function DashboardPageSkeleton({ variant = "detail", className }: Props) {
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-[#F8F9FA] pb-8",
        className,
      )}
      aria-busy
      aria-label="Cargando"
    >
      <header className="sticky top-0 z-20 border-b border-border bg-card px-3 py-3">
        <div className="flex items-center gap-3">
          <Pulse className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <Pulse className="mx-auto h-4 w-40 rounded-md" />
            <Pulse className="mx-auto h-3 w-24 rounded-md" />
          </div>
          <Pulse className="size-10 shrink-0 rounded-full" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 pt-4">
        {variant === "list" ? (
          <>
            <Pulse className="h-7 w-36 rounded-md" />
            <Pulse className="h-4 w-full max-w-sm rounded-md" />
            <Pulse className="h-11 w-full rounded-2xl" />
            <Pulse className="h-10 w-full rounded-xl" />
            <div className="space-y-3 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Pulse key={i} className="h-18 w-full rounded-2xl" />
              ))}
            </div>
          </>
        ) : null}

        {variant === "detail" ? (
          <>
            <Pulse className="h-21 w-full rounded-2xl" />
            <Pulse className="h-24 w-full rounded-2xl" />
            <Pulse className="h-40 w-full rounded-2xl" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Pulse key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          </>
        ) : null}

        {variant === "form" ? (
          <>
            <Pulse className="h-8 w-48 rounded-md" />
            <Pulse className="h-4 w-full rounded-md" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Pulse key={i} className="aspect-4/3 w-full rounded-2xl" />
              ))}
            </div>
            <Pulse className="h-12 w-full rounded-2xl" />
            <Pulse className="h-12 w-full rounded-2xl" />
            <Pulse className="h-14 w-full rounded-2xl" />
          </>
        ) : null}
      </div>
    </div>
  );
}
