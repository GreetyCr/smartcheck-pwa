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
        "pct": 55,
        "rows": 77
      },
      {
        "etiqueta": "Estado regular",
        "nivel": 2,
        "pct": 44.3,
        "rows": 62
      },
      {
        "etiqueta": "Mal estado",
        "nivel": 3,
        "pct": 0.7,
        "rows": 1
      }
    ],
    "sinDato": 6
  },
  "hallazgos": {
    "evaluadas": 144,
    "fueraDelRanking": 2,
    "itemsSinCatalogar": [],
    "minEvaluaciones": 10,
    "porSeccion": [
      {
        "etiqueta": "Sistema de motor",
        "hallazgos": 137,
        "pct": 63.2,
        "revisionesConAlguno": 91,
        "revisionesEvaluadas": 144,
        "seccion": "section_motor"
      },
      {
        "etiqueta": "Carrocería",
        "hallazgos": 154,
        "pct": 57.6,
        "revisionesConAlguno": 83,
        "revisionesEvaluadas": 144,
        "seccion": "section_carroceria"
      },
      {
        "etiqueta": "Sistema eléctrico",
        "hallazgos": 74,
        "pct": 44.4,
        "revisionesConAlguno": 64,
        "revisionesEvaluadas": 144,
        "seccion": "section_electrico"
      },
      {
        "etiqueta": "Interior / accesorios",
        "hallazgos": 90,
        "pct": 38.2,
        "revisionesConAlguno": 55,
        "revisionesEvaluadas": 144,
        "seccion": "section_accesorios"
      },
      {
        "etiqueta": "Iluminación",
        "hallazgos": 45,
        "pct": 25.7,
        "revisionesConAlguno": 37,
        "revisionesEvaluadas": 144,
        "seccion": "section_iluminacion"
      },
      {
        "etiqueta": "Frenos",
        "hallazgos": 40,
        "pct": 24.3,
        "revisionesConAlguno": 35,
        "revisionesEvaluadas": 144,
        "seccion": "section_frenos"
      },
      {
        "etiqueta": "Electrónica",
        "hallazgos": 35,
        "pct": 23.6,
        "revisionesConAlguno": 34,
        "revisionesEvaluadas": 144,
        "seccion": "section_electronica"
      },
      {
        "etiqueta": "Prueba de conducción",
        "hallazgos": 40,
        "pct": 23.2,
        "revisionesConAlguno": 32,
        "revisionesEvaluadas": 138,
        "seccion": "section_conduccion"
      },
      {
        "etiqueta": "Transmisión",
        "hallazgos": 30,
        "pct": 19.4,
        "revisionesConAlguno": 28,
        "revisionesEvaluadas": 144,
        "seccion": "section_transmision"
      },
      {
        "etiqueta": "Dirección",
        "hallazgos": 26,
        "pct": 16,
        "revisionesConAlguno": 23,
        "revisionesEvaluadas": 144,
        "seccion": "section_direccion"
      },
      {
        "etiqueta": "Suspensión",
        "hallazgos": 24,
        "pct": 14.6,
        "revisionesConAlguno": 21,
        "revisionesEvaluadas": 144,
        "seccion": "section_suspension"
      },
      {
        "etiqueta": "Neumáticos",
        "hallazgos": 13,
        "pct": 9,
        "revisionesConAlguno": 13,
        "revisionesEvaluadas": 144,
        "seccion": "section_neumaticos"
      },
      {
        "etiqueta": "Aire acondicionado / calefacción",
        "hallazgos": 11,
        "pct": 6.9,
        "revisionesConAlguno": 10,
        "revisionesEvaluadas": 144,
        "seccion": "section_ac_calefaccion"
      },
      {
        "etiqueta": "Equipo de seguridad",
        "hallazgos": 8,
        "pct": 2.3,
        "revisionesConAlguno": 3,
        "revisionesEvaluadas": 128,
        "seccion": "section_seguridad"
      },
      {
        "etiqueta": "Tracción",
        "hallazgos": 1,
        "pct": 1.9,
        "revisionesConAlguno": 1,
        "revisionesEvaluadas": 54,
        "seccion": "section_traccion"
      },
      {
        "etiqueta": "Sistema de escape",
        "hallazgos": 2,
        "pct": 1.4,
        "revisionesConAlguno": 2,
        "revisionesEvaluadas": 142,
        "seccion": "section_escape"
      },
      {
        "etiqueta": "Combustible",
        "hallazgos": 1,
        "pct": 0.7,
        "revisionesConAlguno": 1,
        "revisionesEvaluadas": 142,
        "seccion": "section_combustible"
      }
    ],
    "promedioPorRevision": 5.1,
    "sinHallazgos": 2,
    "top": [
      {
        "evaluados": 71,
        "hallazgos": 41,
        "item": "aros_rayados_golpes",
        "itemEtiqueta": "Aros rayados o con golpes",
        "pct": 57.7,
        "seccion": "section_carroceria",
        "seccionEtiqueta": "Carrocería"
      },
      {
        "evaluados": 101,
        "hallazgos": 33,
        "item": "nivel_coolant",
        "itemEtiqueta": "Nivel de coolant",
        "pct": 32.7,
        "seccion": "section_motor",
        "seccionEtiqueta": "Sistema de motor"
      },
      {
        "evaluados": 135,
        "hallazgos": 43,
        "item": "carga_bateria_12v",
        "itemEtiqueta": "Carga de batería 12v",
        "pct": 31.9,
        "seccion": "section_electrico",
        "seccionEtiqueta": "Sistema eléctrico"
      },
      {
        "evaluados": 144,
        "hallazgos": 43,
        "item": "fuga_aceite",
        "itemEtiqueta": "Fuga de aceite",
        "pct": 29.9,
        "seccion": "section_motor",
        "seccionEtiqueta": "Sistema de motor"
      },
      {
        "evaluados": 144,
        "hallazgos": 35,
        "item": "indicios_desmontaje_puertas_tapas",
        "itemEtiqueta": "Indicios de desmontaje",
        "pct": 24.3,
        "seccion": "section_carroceria",
        "seccionEtiqueta": "Carrocería"
      },
      {
        "evaluados": 144,
        "hallazgos": 32,
        "item": "codigos_error",
        "itemEtiqueta": "Códigos de error",
        "pct": 22.2,
        "seccion": "section_electronica",
        "seccionEtiqueta": "Electrónica"
      },
      {
        "evaluados": 144,
        "hallazgos": 31,
        "item": "presencia_masilla",
        "itemEtiqueta": "Presencia de masilla",
        "pct": 21.5,
        "seccion": "section_carroceria",
        "seccionEtiqueta": "Carrocería"
      },
      {
        "evaluados": 131,
        "hallazgos": 25,
        "item": "estado_salud_bateria_12v",
        "itemEtiqueta": "Estado de salud batería 12v",
        "pct": 19.1,
        "seccion": "section_electrico",
        "seccionEtiqueta": "Sistema eléctrico"
      },
      {
        "evaluados": 136,
        "hallazgos": 21,
        "item": "nivel_liquido",
        "itemEtiqueta": "Nivel de líquido",
        "pct": 15.4,
        "seccion": "section_frenos",
        "seccionEtiqueta": "Frenos"
      },
      {
        "evaluados": 35,
        "hallazgos": 5,
        "item": "fugas_liquido",
        "itemEtiqueta": "Fugas de líquido",
        "pct": 14.3,
        "seccion": "section_direccion",
        "seccionEtiqueta": "Dirección"
      },
      {
        "evaluados": 140,
        "hallazgos": 19,
        "item": "nivel_aceite",
        "itemEtiqueta": "Nivel de aceite",
        "pct": 13.6,
        "seccion": "section_motor",
        "seccionEtiqueta": "Sistema de motor"
      },
      {
        "evaluados": 144,
        "hallazgos": 19,
        "item": "ruidos_holguras_anormales",
        "itemEtiqueta": "Ruidos u holguras anormales",
        "pct": 13.2,
        "seccion": "section_direccion",
        "seccionEtiqueta": "Dirección"
      }
    ],
    "total": 731
  },
  "nota": "Hallazgos: la polaridad de cada ítem sale de SECTIONS_CONFIG (`findingWhenNo`), la MISMA que usa el PDF — 18 de los 44 ítems sí/no son hallazgo cuando la respuesta es NO. «No aplica» nunca cuenta. El % de cada ítem va sobre las veces que ese ítem SE EVALUÓ, no sobre el total de revisiones. SLA: solo revisiones entregadas con fecha de inicio y de entrega; `sinFechaInicio` dice cuántas quedaron fuera y `inconsistentes` cuántas traen entrega anterior al inicio. Condición: `biVehicleCondition`, que anota el técnico; los porcentajes van sobre las que tienen dato.",
  "revisiones": {
    "conChecklist": 144,
    "entregadas": 142,
    "total": 146
  },
  "sla": {
    "dentroDe24h": 78,
    "dentroDe48h": 87,
    "entregadas": 142,
    "inconsistentes": 0,
    "maxHoras": 81.7,
    "medianaHoras": 4.1,
    "medibles": 93,
    "p90Horas": 30.1,
    "porMes": [
      {
        "medianaHoras": 23.6,
        "rows": 21,
        "ym": "2026-07"
      },
      {
        "medianaHoras": 3.8,
        "rows": 72,
        "ym": "2026-08"
      }
    ],
    "sinFechaEntrega": 0,
    "sinFechaInicio": 49
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
