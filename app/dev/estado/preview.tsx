"use client";

import { EstadoDatosCard, type EstadoDatos } from "@/components/bi/EstadoDatosCard";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Los **tres** estados de la tarjeta, uno debajo del otro.
 *
 * El que hay que aprobar con cuidado es el malo, y en producción —por suerte—
 * no se puede provocar a voluntad. Los datos del primero son los reales al
 * 24-ago-2026.
 *
 * Va en un componente cliente aparte y no en `page.tsx`: los handlers de los
 * botones no pueden cruzar la frontera servidor→cliente —el navegador lo dijo
 * con un error de runtime— y la página tiene que seguir siendo de servidor para
 * poder hacer `notFound()` en producción.
 */
const SANO: EstadoDatos = {
  "diasParaAtraso": 8,
  "hayAtraso": false,
  "hayError": false,
  "procesos": [
    {
      "atrasado": false,
      "cadencia": "semanal",
      "diasDesde": 3.7,
      "etiqueta": "Enlace contacto ↔ revisión",
      "key": "matches_rebuild",
      "lastRunAt": 1788402830826,
      "lastStatus": "ok",
      "message": "converted=299",
      "queEs": "Recalcula quién de los contactos terminó siendo cliente.",
      "rowsProcessed": 300
    },
    {
      "atrasado": false,
      "cadencia": "semanal",
      "diasDesde": 6.4,
      "etiqueta": "Contraste con la hoja de cálculo",
      "key": "sheet_contrast",
      "lastRunAt": 1788168637975,
      "lastStatus": "ok",
      "message": "13 meses contrastados, todos cuadran",
      "queEs": "Compara mes a mes lo que hay acá contra la hoja, por si algo cambió allá.",
      "rowsProcessed": 13
    },
    {
      "atrasado": false,
      "cadencia": "semanal",
      "diasDesde": 6.5,
      "etiqueta": "Contactos desde Airtable",
      "key": "leads_sync",
      "lastRunAt": 1788166940390,
      "lastStatus": "ok",
      "message": "full: fetched=9290 ins=194 patch=9096 fail=0 issues=2116",
      "queEs": "Trae los contactos nuevos y actualiza los que cambiaron.",
      "rowsProcessed": 9290
    },
    {
      "atrasado": false,
      "cadencia": "semanal",
      "diasDesde": 6.5,
      "etiqueta": "Revisión de contactos",
      "key": "leads_reconcile",
      "lastRunAt": 1788166939116,
      "lastStatus": "ok",
      "message": "full: airtable=9290 vistas=9290 huérfanas=0 nativas=0 delta=0",
      "queEs": "Comprueba que lo que hay acá siga cuadrando con Airtable.",
      "rowsProcessed": 9290
    },
    {
      "atrasado": false,
      "cadencia": "unica",
      "diasDesde": 42.6,
      "etiqueta": "Carga del sistema anterior",
      "key": "legacy_migration",
      "lastRunAt": 1785039786489,
      "lastStatus": "ok",
      "message": "prod cut: 743 ins, Hans borrado, correcciones+Toyota aplicadas",
      "queEs": "Las revisiones del CRM viejo. Se hizo una vez y no se repite.",
      "rowsProcessed": 742
    },
    {
      "atrasado": false,
      "cadencia": "unica",
      "diasDesde": 42.6,
      "etiqueta": "Carga inicial de finanzas",
      "key": "finance_migration",
      "lastRunAt": 1785039726629,
      "lastStatus": "ok",
      "message": "runId=prod-cut-finance ins=505 patch=0 fail=0",
      "queEs": "La carga de la hoja de cálculo. Se hizo una vez y no se repite.",
      "rowsProcessed": 505
    }
  ],
  "sinDeclarar": [],
  "ultimaActualizacion": 1788402830826
};

const CON_ERROR: EstadoDatos = {
  ...SANO,
  hayError: true,
  procesos: SANO.procesos.map((p, i) =>
    i === 0
      ? { ...p, lastStatus: "error", message: "airtable 500 en la página 12 de 19" }
      : p,
  ),
};

const ATRASADO: EstadoDatos = {
  ...SANO,
  hayAtraso: true,
  procesos: SANO.procesos.map((p) =>
    p.cadencia === "semanal" ? { ...p, diasDesde: 12.4, atrasado: true } : p,
  ),
};

export function EstadoPreview() {
  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — los tres estados. Los botones
        no hacen nada acá. No existe en producción.
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <div className="max-w-3xl space-y-5">
          <EstadoDatosCard
            data={SANO}
            onActualizarLeads={async () => {}}
            onRecalcular={async () => {}}
          />
          <EstadoDatosCard data={CON_ERROR} />
          <EstadoDatosCard data={ATRASADO} />
        </div>
      </div>
    </>
  );
}
