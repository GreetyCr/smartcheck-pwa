import { Button } from "@/components/ui/button";

export default function MarketingHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background font-sans">
      <main className="flex max-w-3xl flex-col items-center gap-8 px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">
          Smartcheck
        </h1>
        <p className="text-lg text-muted-foreground">
          Inspección pre-compra de vehículos. Costa Rica.
        </p>
        <div className="flex gap-4">
          <Button>Iniciar sesión</Button>
          <Button variant="outline">Más información</Button>
        </div>
      </main>
    </div>
  );
}
