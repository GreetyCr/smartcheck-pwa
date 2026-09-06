import { notFound } from "next/navigation";
import { CalidadDashboard, type CalidadData } from "@/components/bi/CalidadDashboard";
import { CATALOGO } from "@/convex/bi/calidad";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Revisión visual de **Calidad**, sin sesión y sin tocar datos.
 * 404 en producción real (mismo criterio que `/dev/finanzas`).
 *
 * Los conteos son los reales de producción al 24-ago-2026, pero **los textos se
 * importan del catálogo**, no se copian. Es a propósito: en las otras vistas de
 * muestra ya pasó dos veces que la copia a mano se desincronizara de la fuente.
 */
/**
 * **Los teléfonos de esta muestra son INVENTADOS, y tienen que seguir siéndolo.**
 *
 * Los avisos de Calidad pintan `ejemplos` en pantalla, y en producción esos
 * ejemplos traen el teléfono real del lead: «teléfono 84441492: 2 contactos…».
 * Hasta el 6-set esta muestra tenía **tres teléfonos reales de clientes**,
 * copiados de producción y **commiteados en un repo público**.
 *
 * Lo destapó la guarda de `herramientas/fixtures.py` al intentar regenerar esta
 * página desde PROD — no lo vio ninguna de las dos rondas de QA. Van con el
 * prefijo `6000000N`, que no corresponde a ningún teléfono de Costa Rica.
 *
 * **Consecuencia para el manual: Calidad NO se captura desde producción.** Es la
 * tercera pantalla con datos de personas, además de Leads e Inspecciones.
 */
const CONTEOS = [
  {
    issueType: "reconciliation_gap",
    sinResolver: 10,
    resueltos: 0,
    ejemplos: ["julio de 2026: la contabilidad dice ₡4.546.000 vs las revisiones suman ₡4.937.141 · diferencia de −₡391.141 (−8,6%)", "mayo de 2026: la contabilidad dice ₡4.376.000 vs las revisiones suman ₡4.130.617 · diferencia de ₡245.383 (5,61%)", "abril de 2026: la contabilidad dice ₡3.971.750 vs las revisiones suman ₡3.163.000 · diferencia de ₡808.750 (20,36%)"],
  },
  {
    issueType: "malformed_row",
    sinResolver: 1,
    resueltos: 0,
    ejemplos: ["fila sin fecha ni nombre; monto ₡6.833.000; excluida"],
  },
  {
    issueType: "anomalous_phone",
    sinResolver: 165,
    resueltos: 0,
    ejemplos: ["PSID/no-teléfono (13 díg, Messenger/IG)", "teléfono no-CR (prefijo internacional, 11 díg)", "teléfono no-CR (prefijo internacional, 11 díg)"],
  },
  {
    issueType: "ambiguous_match",
    sinResolver: 31,
    resueltos: 0,
    ejemplos: ["teléfono 60000001: 2 contactos × 1 revisión; se decidió por la marca del carro y las fechas", "teléfono 60000002: 2 contactos × 1 revisión; se decidió por la marca del carro y las fechas", "teléfono 60000003: 2 contactos × 1 revisión; se decidió por la marca del carro y las fechas"],
  },
  {
    issueType: "lead_no_key",
    sinResolver: 31,
    resueltos: 0,
    ejemplos: ["sin teléfono ni identificador de ManyChat: no hay con qué reconocerlo", "sin teléfono ni identificador de ManyChat: no hay con qué reconocerlo", "sin teléfono ni identificador de ManyChat: no hay con qué reconocerlo"],
  },
  {
    issueType: "currency_ambiguous",
    sinResolver: 0,
    resueltos: 4,
    ejemplos: [],
  },
  {
    issueType: "zero_or_missing_amount",
    sinResolver: 0,
    resueltos: 4,
    ejemplos: [],
  },
  {
    issueType: "outlier_amount",
    sinResolver: 0,
    resueltos: 1,
    ejemplos: [],
  },
  {
    issueType: "missing_date",
    sinResolver: 0,
    resueltos: 2,
    ejemplos: [],
  },
  {
    issueType: "viatico_review",
    sinResolver: 0,
    resueltos: 40,
    ejemplos: [],
  },
  {
    issueType: "lead_dup",
    sinResolver: 1869,
    resueltos: 0,
    ejemplos: ["dup manychatId 609898339 (grupo de 2)", "dup manychatId 609898339 (grupo de 2)", "dup manychatId 1042153375 (grupo de 2)"],
  },
] as const;

const tipos = CONTEOS.map((c) => {
  const e = CATALOGO[c.issueType] ?? {
    clase: "accion",
    origen: "sistema",
    titulo: "Tipo de aviso sin clasificar",
    queEs: "Apareció un tipo de aviso que todavía no describimos.",
    queHacer: "Avisarnos: hay que decidir si pide acción o es esperado.",
  };
  return { ...c, ejemplos: [...c.ejemplos], ...e };
});

const MUESTRA: CalidadData = {
  totalIssues: 2158,
  sinResolver: 2107,
  resueltos: 51,
  porClase: tipos.reduce(
    (a, t) => ({ ...a, [t.clase]: a[t.clase as keyof typeof a] + t.sinResolver }),
    { accion: 0, informativo: 0, esperado: 0 },
  ),
  porOrigen: tipos.reduce(
    (a, t) => ({ ...a, [t.origen]: a[t.origen as keyof typeof a] + t.sinResolver }),
    { sistema: 0, airtable: 0, migracion: 0 },
  ),
  tipos,
  sinCatalogar: [],
  cobertura: [
    { campo: "Contactos con teléfono utilizable", presentes: 8920, total: 9096, pct: 98.1, faltan: 176 },
    { campo: "Contactos con nombre", presentes: 8904, total: 9096, pct: 97.9, faltan: 192 },
    { campo: "Contactos con identificador de chat", presentes: 8622, total: 9096, pct: 94.8, faltan: 474 },
    { campo: "Revisiones con canal anotado", presentes: 877, total: 882, pct: 99.4, faltan: 5 },
    { campo: "Revisiones con monto", presentes: 882, total: 882, pct: 100, faltan: 0 },
  ],
};

export default function DevCalidadPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — conteos reales al 24-ago-2026.
        No existe en producción.
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <CalidadDashboard data={MUESTRA} />
      </div>
    </>
  );
}
