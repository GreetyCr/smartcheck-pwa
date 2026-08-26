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
    "procesos": [
      {
        "key": "leads_sync",
        "etiqueta": "Contactos desde Airtable",
        "queEs": "Trae los contactos nuevos y actualiza los que cambiaron.",
        "cadencia": "semanal",
        "lastRunAt": 1787561649299,
        "lastStatus": "ok",
        "message": "full: fetched=9096 ins=198 patch=8898 fail=0",
        "rowsProcessed": 9096,
        "diasDesde": 1.7,
        "atrasado": false
      },
      {
        "key": "matches_rebuild",
        "etiqueta": "Enlace contacto ↔ revisión",
        "queEs": "Recalcula quién de los contactos terminó siendo cliente.",
        "cadencia": "semanal",
        "lastRunAt": 1787561649299,
        "lastStatus": "ok",
        "message": "converted=275",
        "rowsProcessed": 276,
        "diasDesde": 1.7,
        "atrasado": false
      },
      {
        "key": "leads_reconcile",
        "etiqueta": "Revisión de contactos",
        "queEs": "Comprueba que lo que hay acá siga cuadrando con Airtable.",
        "cadencia": "semanal",
        "lastRunAt": 1787561649299,
        "lastStatus": "ok",
        "message": "full: airtable=9096 vistas=9096 huérfanas=0 delta=0",
        "rowsProcessed": 9096,
        "diasDesde": 1.7,
        "atrasado": false
      },
      {
        "key": "legacy_migration",
        "etiqueta": "Carga del sistema anterior",
        "queEs": "Las revisiones del CRM viejo. Se hizo una vez y no se repite.",
        "cadencia": "unica",
        "lastRunAt": 1785030129299,
        "lastStatus": "ok",
        "message": "prod cut: 743 ins",
        "rowsProcessed": 742,
        "diasDesde": 30.9,
        "atrasado": false
      },
      {
        "key": "finance_migration",
        "etiqueta": "Carga inicial de finanzas",
        "queEs": "La carga de la hoja de cálculo. Se hizo una vez y no se repite.",
        "cadencia": "unica",
        "lastRunAt": 1785030129299,
        "lastStatus": "ok",
        "message": "ins=505 fail=0",
        "rowsProcessed": 505,
        "diasDesde": 30.9,
        "atrasado": false
      }
    ],
    "ultimaActualizacion": 1787561649299,
    "hayError": false,
    "hayAtraso": false,
    "sinDeclarar": [],
    "diasParaAtraso": 8
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
