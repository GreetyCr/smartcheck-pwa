"use client";

import { useSearchParams } from "next/navigation";
import {
  AdminMobileHeader,
  AdminSidebar,
} from "@/components/admin/AdminSidebar";
import { ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * **El menú solo, para el bloque «Cómo llegar» de cada capítulo — A154.**
 *
 * Las capturas de pantalla salen sin barra lateral: es idéntica en las once y se
 * llevaría el 20% de cada imagen sin decir nada nuevo. En su lugar va ésta.
 *
 * Dos cosas que se aprendieron con la primera versión, las dos al mirar la foto
 * dentro del documento:
 *
 * 1. **El ítem activo se pasa por la URL** (`?activo=/admin/finanzas`), así que
 *    cada capítulo lleva su menú con SU opción resaltada. Antes salía de
 *    `/dev/admin/tablas`, que resalta «Inspecciones»: correcto para esa página
 *    y **falso en diez de los once capítulos** que comparten la foto.
 * 2. **Sin el globo de aprobaciones pendientes.** El marco de revisión lo pinta
 *    con un «2» sobre Técnicos; en una foto rotulada «cómo llegar» eso se lee
 *    como el paso 2 y manda al lector a la pantalla equivocada.
 *
 * No usa `DevAdminShell` justamente por lo segundo: ese marco fija el contador
 * en 2 para poder revisarlo, que es lo correcto ahí y lo incorrecto acá.
 */
export function MenuPreview() {
  const params = useSearchParams();
  const activo = params.get("activo") ?? "";
  /* `?abierto=1` deja el cajón desplegado. En el teléfono el menú está
     escondido, así que llegar a una pantalla son DOS pasos —abrir y elegir— y
     el manual necesita una foto de cada uno. */
  const abierto = params.get("abierto") === "1";

  return (
    <div className={cn(ADMIN_THEME_CLASS, "flex min-h-dvh")}>
      <AdminSidebar
        open={abierto}
        onClose={() => {}}
        pendingApprovals={0}
        activePath={activo}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileHeader onMenuClick={() => {}} pendingApprovals={0} />
      </div>
    </div>
  );
}
