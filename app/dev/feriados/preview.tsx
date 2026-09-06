"use client";

import { useState } from "react";
import { FeriadosDashboard } from "@/components/bi/FeriadosDashboard";
import type { FeriadosPanel } from "@/components/bi/types";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Muestra congelada **al 1-set-2026**, con los conteos reales de producción: de
 * las 904 revisiones, **12 cayeron en feriado de pago obligatorio** (8 del CRM
 * viejo, 4 de la app) y **2 en uno de pago no obligatorio**. Se regenera con
 * `npx convex run --prod bi/feriados:feriados '{}'`.
 *
 * Los días de la semana están **calculados, no transcritos**: que el 25 de julio
 * y el 15 de agosto de 2026 cayeran sábado es justo lo que hace que la pregunta
 * «¿se trabajó?» tenga sentido en este negocio, así que escribirlos a mano sería
 * pedir el error.
 *
 * Se muestran los dos estados que hay que poder aprobar: un año cubierto y un
 * año que la tabla **no conoce**, que es el que no puede verse igual que un año
 * sin feriados.
 */
const BASE = {
  cubierto: true,
  aniosCubiertos: [2025, 2026, 2027],
  verificadoAl: "2026-09-01",
  proximos: [
    { fecha: "2026-09-15", nombre: "Independencia", tipo: "obligatorio", diaSemana: "martes", faltanDias: 14 },
    { fecha: "2026-12-01", nombre: "Abolición del Ejército", tipo: "no_obligatorio", diaSemana: "martes", faltanDias: 91 },
    { fecha: "2026-12-25", nombre: "Navidad", tipo: "obligatorio", diaSemana: "viernes", faltanDias: 115 },
  ],
  revisionesEnObligatorio: 12,
  revisionesEnNoObligatorio: 2,
  note: "Muestra congelada del 1-set-2026.",
};

const PANEL: FeriadosPanel = {
  "anio": 2026,
  "aniosCubiertos": [
    2025,
    2026,
    2027
  ],
  "cubierto": true,
  "delAnio": [
    {
      "diaSemana": "jueves",
      "fecha": "2026-01-01",
      "nombre": "Año Nuevo",
      "pasado": true,
      "revisiones": 0,
      "revisionesApp": 0,
      "revisionesHistorico": 0,
      "tipo": "obligatorio"
    },
    {
      "diaSemana": "jueves",
      "fecha": "2026-04-02",
      "nombre": "Jueves Santo",
      "pasado": true,
      "revisiones": 0,
      "revisionesApp": 0,
      "revisionesHistorico": 0,
      "tipo": "obligatorio"
    },
    {
      "diaSemana": "viernes",
      "fecha": "2026-04-03",
      "nombre": "Viernes Santo",
      "pasado": true,
      "revisiones": 0,
      "revisionesApp": 0,
      "revisionesHistorico": 0,
      "tipo": "obligatorio"
    },
    {
      "diaSemana": "sábado",
      "fecha": "2026-04-11",
      "nombre": "Batalla de Rivas (Juan Santamaría)",
      "pasado": true,
      "revisiones": 1,
      "revisionesApp": 0,
      "revisionesHistorico": 1,
      "tipo": "obligatorio"
    },
    {
      "diaSemana": "viernes",
      "fecha": "2026-05-01",
      "nombre": "Día Internacional del Trabajo",
      "pasado": true,
      "revisiones": 0,
      "revisionesApp": 0,
      "revisionesHistorico": 0,
      "tipo": "obligatorio"
    },
    {
      "diaSemana": "sábado",
      "fecha": "2026-07-25",
      "nombre": "Anexión del Partido de Nicoya",
      "pasado": true,
      "revisiones": 2,
      "revisionesApp": 2,
      "revisionesHistorico": 0,
      "tipo": "obligatorio"
    },
    {
      "diaSemana": "domingo",
      "fecha": "2026-08-02",
      "nombre": "Virgen de los Ángeles",
      "pasado": true,
      "revisiones": 0,
      "revisionesApp": 0,
      "revisionesHistorico": 0,
      "tipo": "no_obligatorio"
    },
    {
      "diaSemana": "sábado",
      "fecha": "2026-08-15",
      "nombre": "Día de la Madre",
      "pasado": true,
      "revisiones": 2,
      "revisionesApp": 2,
      "revisionesHistorico": 0,
      "tipo": "obligatorio"
    },
    {
      "diaSemana": "lunes",
      "fecha": "2026-08-31",
      "nombre": "Día de la Persona Negra y la Cultura Afrocostarricense",
      "pasado": true,
      "revisiones": 2,
      "revisionesApp": 2,
      "revisionesHistorico": 0,
      "tipo": "no_obligatorio"
    },
    {
      "diaSemana": "martes",
      "fecha": "2026-09-15",
      "nombre": "Independencia",
      "pasado": false,
      "revisiones": 0,
      "revisionesApp": 0,
      "revisionesHistorico": 0,
      "tipo": "obligatorio"
    },
    {
      "diaSemana": "martes",
      "fecha": "2026-12-01",
      "nombre": "Abolición del Ejército",
      "pasado": false,
      "revisiones": 0,
      "revisionesApp": 0,
      "revisionesHistorico": 0,
      "tipo": "no_obligatorio"
    },
    {
      "diaSemana": "viernes",
      "fecha": "2026-12-25",
      "nombre": "Navidad",
      "pasado": false,
      "revisiones": 0,
      "revisionesApp": 0,
      "revisionesHistorico": 0,
      "tipo": "obligatorio"
    }
  ],
  "note": "Feriados de Costa Rica con fechas explícitas por año (el 12 de octubre dejó de ser feriado con la Ley 9803; el traslado a lunes caducó en 2024). Pago obligatorio: se paga aunque no se trabaje, y doble si se trabaja (CT art. 152). Las revisiones salen de inspections_all, así que cuadran con el resto del tablero.",
  "proximos": [
    {
      "diaSemana": "martes",
      "faltanDias": 9,
      "fecha": "2026-09-15",
      "nombre": "Independencia",
      "tipo": "obligatorio"
    },
    {
      "diaSemana": "martes",
      "faltanDias": 86,
      "fecha": "2026-12-01",
      "nombre": "Abolición del Ejército",
      "tipo": "no_obligatorio"
    },
    {
      "diaSemana": "viernes",
      "faltanDias": 110,
      "fecha": "2026-12-25",
      "nombre": "Navidad",
      "tipo": "obligatorio"
    }
  ],
  "revisionesEnNoObligatorio": 2,
  "revisionesEnObligatorio": 12,
  "verificadoAl": "2026-09-01"
};

/** El año que la tabla no conoce: tiene que verse distinto de «no hay feriados». */
const PANEL_SIN_DATOS: FeriadosPanel = {
  ...BASE,
  anio: 2035,
  cubierto: false,
  delAnio: [],
};

export function FeriadosPreview() {
  const [sinDatos, setSinDatos] = useState(false);
  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — conteos reales de producción
        congelados al 1-set-2026. No existe en producción.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => setSinDatos((v) => !v)}
        >
          {sinDatos ? "Ver 2026" : "Ver un año sin datos (2035)"}
        </button>
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <FeriadosDashboard
          panel={sinDatos ? PANEL_SIN_DATOS : PANEL}
          onCambiarAnio={() => {}}
        />
      </div>
    </>
  );
}
