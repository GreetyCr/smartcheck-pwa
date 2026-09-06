"use client";

import { OperacionDashboard } from "@/components/bi/OperacionDashboard";
import type { Operacion } from "@/components/bi/types";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Respuesta **literal** de producción del 25-ago-2026. No es una muestra
 * inventada: los casos que ponen a prueba el diseño son los reales —«Aros
 * rayados» al 57,7% pero sobre 71 evaluaciones y no 144, las 49 revisiones
 * entregadas sin fecha de inicio que dejan el SLA en 93 de 142, y la caída de
 * la mediana de 23,6 h en julio a 3,8 h en agosto—.
 *
 * Regenerar con:  npx convex run --prod bi/operacion:operacion '{}'
 */
const DATOS: Operacion = {
  "condicion": {
    "niveles": [
      {
        "etiqueta": "Buen estado",
        "nivel": 1,
        "pct": 53.6,
        "rows": 89
      },
      {
        "etiqueta": "Estado regular",
        "nivel": 2,
        "pct": 45.8,
        "rows": 76
      },
      {
        "etiqueta": "Mal estado",
        "nivel": 3,
        "pct": 0.6,
        "rows": 1
      }
    ],
    "sinDato": 6
  },
  "hallazgos": {
    "conHallazgos": 88,
    "elegibles": 87,
    "evaluadas": 170,
    "fueraDelRanking": 1,
    "itemsSinCatalogar": [],
    "minEvaluaciones": 10,
    "porSeccion": [
      {
        "etiqueta": "Sistema de motor",
        "hallazgos": 158,
        "pct": 62.4,
        "revisionesConAlguno": 106,
        "revisionesEvaluadas": 170,
        "seccion": "section_motor"
      },
      {
        "etiqueta": "Carrocería",
        "hallazgos": 161,
        "pct": 52.4,
        "revisionesConAlguno": 89,
        "revisionesEvaluadas": 170,
        "seccion": "section_carroceria"
      },
      {
        "etiqueta": "Sistema eléctrico",
        "hallazgos": 93,
        "pct": 45.9,
        "revisionesConAlguno": 78,
        "revisionesEvaluadas": 170,
        "seccion": "section_electrico"
      },
      {
        "etiqueta": "Interior / accesorios",
        "hallazgos": 102,
        "pct": 37.1,
        "revisionesConAlguno": 63,
        "revisionesEvaluadas": 170,
        "seccion": "section_accesorios"
      },
      {
        "etiqueta": "Iluminación",
        "hallazgos": 58,
        "pct": 27.1,
        "revisionesConAlguno": 46,
        "revisionesEvaluadas": 170,
        "seccion": "section_iluminacion"
      },
      {
        "etiqueta": "Prueba de conducción",
        "hallazgos": 46,
        "pct": 23.6,
        "revisionesConAlguno": 38,
        "revisionesEvaluadas": 161,
        "seccion": "section_conduccion"
      },
      {
        "etiqueta": "Frenos",
        "hallazgos": 46,
        "pct": 23.5,
        "revisionesConAlguno": 40,
        "revisionesEvaluadas": 170,
        "seccion": "section_frenos"
      },
      {
        "etiqueta": "Electrónica",
        "hallazgos": 39,
        "pct": 22.4,
        "revisionesConAlguno": 38,
        "revisionesEvaluadas": 170,
        "seccion": "section_electronica"
      },
      {
        "etiqueta": "Transmisión",
        "hallazgos": 33,
        "pct": 17.6,
        "revisionesConAlguno": 30,
        "revisionesEvaluadas": 170,
        "seccion": "section_transmision"
      },
      {
        "etiqueta": "Dirección",
        "hallazgos": 33,
        "pct": 17.6,
        "revisionesConAlguno": 30,
        "revisionesEvaluadas": 170,
        "seccion": "section_direccion"
      },
      {
        "etiqueta": "Suspensión",
        "hallazgos": 27,
        "pct": 13.5,
        "revisionesConAlguno": 23,
        "revisionesEvaluadas": 170,
        "seccion": "section_suspension"
      },
      {
        "etiqueta": "Neumáticos",
        "hallazgos": 17,
        "pct": 10,
        "revisionesConAlguno": 17,
        "revisionesEvaluadas": 170,
        "seccion": "section_neumaticos"
      },
      {
        "etiqueta": "Aire acondicionado / calefacción",
        "hallazgos": 14,
        "pct": 7.6,
        "revisionesConAlguno": 13,
        "revisionesEvaluadas": 170,
        "seccion": "section_ac_calefaccion"
      },
      {
        "etiqueta": "Equipo de seguridad",
        "hallazgos": 10,
        "pct": 3.3,
        "revisionesConAlguno": 5,
        "revisionesEvaluadas": 151,
        "seccion": "section_seguridad"
      },
      {
        "etiqueta": "Tracción",
        "hallazgos": 1,
        "pct": 1.6,
        "revisionesConAlguno": 1,
        "revisionesEvaluadas": 63,
        "seccion": "section_traccion"
      },
      {
        "etiqueta": "Sistema de escape",
        "hallazgos": 2,
        "pct": 1.2,
        "revisionesConAlguno": 2,
        "revisionesEvaluadas": 168,
        "seccion": "section_escape"
      },
      {
        "etiqueta": "Combustible",
        "hallazgos": 1,
        "pct": 0.6,
        "revisionesConAlguno": 1,
        "revisionesEvaluadas": 168,
        "seccion": "section_combustible"
      }
    ],
    "promedioPorRevision": 4.9,
    "sinHallazgos": 2,
    "top": [
      {
        "evaluados": 74,
        "hallazgos": 41,
        "item": "aros_rayados_golpes",
        "itemEtiqueta": "Aros rayados o con golpes",
        "pct": 55.4,
        "seccion": "section_carroceria",
        "seccionEtiqueta": "Carrocería"
      },
      {
        "evaluados": 160,
        "hallazgos": 53,
        "item": "carga_bateria_12v",
        "itemEtiqueta": "Carga de batería 12v",
        "pct": 33.1,
        "seccion": "section_electrico",
        "seccionEtiqueta": "Sistema eléctrico"
      },
      {
        "evaluados": 129,
        "hallazgos": 40,
        "item": "nivel_coolant",
        "itemEtiqueta": "Nivel de coolant",
        "pct": 31,
        "seccion": "section_motor",
        "seccionEtiqueta": "Sistema de motor"
      },
      {
        "evaluados": 170,
        "hallazgos": 48,
        "item": "fuga_aceite",
        "itemEtiqueta": "Fuga de aceite",
        "pct": 28.2,
        "seccion": "section_motor",
        "seccionEtiqueta": "Sistema de motor"
      },
      {
        "evaluados": 170,
        "hallazgos": 36,
        "item": "codigos_error",
        "itemEtiqueta": "Códigos de error",
        "pct": 21.2,
        "seccion": "section_electronica",
        "seccionEtiqueta": "Electrónica"
      },
      {
        "evaluados": 170,
        "hallazgos": 35,
        "item": "indicios_desmontaje_puertas_tapas",
        "itemEtiqueta": "Indicios de desmontaje",
        "pct": 20.6,
        "seccion": "section_carroceria",
        "seccionEtiqueta": "Carrocería"
      },
      {
        "evaluados": 155,
        "hallazgos": 32,
        "item": "estado_salud_bateria_12v",
        "itemEtiqueta": "Estado de salud batería 12v",
        "pct": 20.6,
        "seccion": "section_electrico",
        "seccionEtiqueta": "Sistema eléctrico"
      },
      {
        "evaluados": 170,
        "hallazgos": 32,
        "item": "presencia_masilla",
        "itemEtiqueta": "Presencia de masilla",
        "pct": 18.8,
        "seccion": "section_carroceria",
        "seccionEtiqueta": "Carrocería"
      },
      {
        "evaluados": 170,
        "hallazgos": 26,
        "item": "ruidos_holguras_anormales",
        "itemEtiqueta": "Ruidos u holguras anormales",
        "pct": 15.3,
        "seccion": "section_direccion",
        "seccionEtiqueta": "Dirección"
      },
      {
        "evaluados": 20,
        "hallazgos": 3,
        "item": "aspecto_liquido_transmision",
        "itemEtiqueta": "Aspecto de líquido de transmisión",
        "pct": 15,
        "seccion": "section_transmision",
        "seccionEtiqueta": "Transmisión"
      },
      {
        "evaluados": 166,
        "hallazgos": 24,
        "item": "nivel_aceite",
        "itemEtiqueta": "Nivel de aceite",
        "pct": 14.5,
        "seccion": "section_motor",
        "seccionEtiqueta": "Sistema de motor"
      },
      {
        "evaluados": 170,
        "hallazgos": 24,
        "item": "luces_traseras",
        "itemEtiqueta": "Luces traseras",
        "pct": 14.1,
        "seccion": "section_iluminacion",
        "seccionEtiqueta": "Iluminación"
      }
    ],
    "tope": 12,
    "total": 841
  },
  "revisiones": {
    "conChecklist": 170,
    "entregadas": 170,
    "total": 172
  },
  "sla": {
    "dentroDe24h": 103,
    "dentroDe48h": 112,
    "entregadas": 170,
    "inconsistentes": 0,
    "maxHoras": 81.7,
    "medianaHoras": 3.9,
    "medibles": 118,
    "p90Horas": 26.4,
    "porMes": [
      {
        "medianaHoras": 23.6,
        "rows": 21,
        "ym": "2026-07"
      },
      {
        "medianaHoras": 3.5,
        "rows": 87,
        "ym": "2026-08"
      },
      {
        "medianaHoras": 3.2,
        "rows": 10,
        "ym": "2026-09"
      }
    ],
    "sinFechaInicio": 52
  }
};

export function OperacionPreview() {
  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — datos reales de producción
        congelados. No existe en producción.
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <OperacionDashboard data={DATOS} />
      </div>
    </>
  );
}
