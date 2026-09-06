import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MenuPreview } from "./preview";

/**
 * El menú del panel para las capturas de «Cómo llegar».
 * `?activo=/admin/finanzas` resalta esa opción.
 *
 * El `Suspense` es obligatorio: `useSearchParams` lo exige para poder
 * pre-renderizar el resto de la página.
 */
export default function DevMenuPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <Suspense>
      <MenuPreview />
    </Suspense>
  );
}
