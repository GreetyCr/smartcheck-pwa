"use client";

import { TriangleAlert } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { categoryLabel, formatCRC, formatPct } from "@/lib/bi-format";

export type EtiquetaGrupo = {
  etiqueta: string;
  rows: number;
  amountCRC: number;
  /** Peso dentro de SU grupo, no sobre el total. */
  pctGrupo: number;
};

/**
 * Los periodos que ofrece la tarjeta.
 *
 * Presets y no un selector de fechas libre: la pregunta que se hace acá es
 * «¿esto sigue igual que antes?», y para eso sirven tres cortes fijos. Un rango
 * a medida obligaría a elegir dos fechas cada vez para contestar algo que se
 * contesta con un clic.
 */
export const PERIODOS = [
  { key: "todo", label: "Todo" },
  { key: "12m", label: "12 meses", meses: 12 },
  { key: "6m", label: "6 meses", meses: 6 },
  { key: "3m", label: "3 meses", meses: 3 },
] as const;

export type PeriodoKey = (typeof PERIODOS)[number]["key"];

/**
 * `[desde, hasta)` para un preset, en zona CR y **alineado al inicio de mes**.
 *
 * Alinear importa: con un corte a «hace 90 días exactos» el mes más viejo del
 * rango entraría partido y su total se leería como una caída del proveedor,
 * cuando lo único que pasó es que faltan días.
 */
export function rangoDelPeriodo(key: PeriodoKey, ahora = Date.now()): {
  fromMs?: number;
} {
  const preset = PERIODOS.find((p) => p.key === key);
  const meses = preset && "meses" in preset ? preset.meses : undefined;
  if (!meses) return {};
  const d = new Date(ahora);
  const desde = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (meses - 1), 1, 6),
  );
  return { fromMs: desde.getTime() };
}

/**
 * El **periodo inmediatamente anterior** al preset, del mismo largo — A135.
 *
 * Sirve para poder decir «cuánto más o menos que antes», que es lo que
 * convierte una cifra suelta en un hecho. Sin comparación, «₡1,1M de utilidad»
 * no le dice a nadie si el mes fue bueno.
 *
 * Devuelve `null` para «Todo»: no hay un antes de todo el histórico, y fabricar
 * una comparación ahí sería inventarla.
 *
 * El rango es **semiabierto** `[desde, hasta)` y `hasta` es exactamente el
 * `fromMs` del periodo actual, así que los dos tramos no comparten ni un día.
 */
export function rangoAnterior(
  key: PeriodoKey,
  ahora = Date.now(),
): { fromMs: number; toMs: number } | null {
  const preset = PERIODOS.find((p) => p.key === key);
  const meses = preset && "meses" in preset ? preset.meses : undefined;
  if (!meses) return null;
  const actual = rangoDelPeriodo(key, ahora);
  if (actual.fromMs == null) return null;
  const d = new Date(ahora);
  const desde = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (meses * 2 - 1), 1, 6),
  );
  return { fromMs: desde.getTime(), toMs: actual.fromMs };
}

/**
 * `[desde, hasta)` de **un mes** (`"2026-07"`), en zona de Costa Rica — A158.
 *
 * Vive acá y no en la página porque es el par del `rangoDelPeriodo` de arriba:
 * el desglose se pide con uno o con otro según haya un mes elegido, y tenerlos
 * juntos es lo que evita que uno de los dos se corra medio día.
 */
export function rangoDelMes(yearMonth: string): {
  fromMs: number;
  toMs: number;
} {
  const [y, m] = yearMonth.split("-").map(Number);
  // Las 6 UTC son la medianoche de Costa Rica, igual que `rangoDelPeriodo`.
  const desde = Date.UTC(y, m - 1, 1, 6);
  const hasta = Date.UTC(y, m, 1, 6);
  return { fromMs: desde, toMs: hasta };
}

export type ExpenseBreakdown = {
  categorias: string[];
  totalCRC: number;
  totalRows: number;
  grupos: Array<{
    grupo: string;
    rows: number;
    amountCRC: number;
    pct: number;
    etiquetas: EtiquetaGrupo[];
  }>;
  /** No lleva `pctGrupo`: no pertenece a ningún grupo, ese es su problema. */
  sinClasificar: Array<{ etiqueta: string; rows: number; amountCRC: number }>;
};

/** Nombres para mostrar. Los internos son claves; estos son los de Esteban. */
const NOMBRES: Record<string, string> = {
  servicios_profesionales: "Servicios profesionales",
  software: "Software y herramientas",
  viaticos_tecnico: "Viáticos del técnico",
  equipo: "Equipo",
  telefonia: "Telefonía",
  sin_clasificar: "Sin clasificar",
};

/**
 * Qué hay adentro de «Otros» (A61 · A83).
 *
 * El problema que resuelve: «Otros» se lleva casi un tercio del gasto, y un
 * tercio de la plata en una bolsa sin nombre no sirve para decidir nada.
 *
 * **«Sin clasificar» se muestra aparte y con nombre y apellido**, no mezclado
 * entre los demás grupos. Es a propósito: si apareciera como una barra más,
 * volvería a ser una bolsa anónima — justo lo que esta tarjeta existe para
 * eliminar. Acá se lista **qué proveedor** falta acomodar y cuánto pesa, que es
 * lo único accionable.
 */
export function ExpenseGroupsCard({
  data,
  alcance,
}: {
  data: ExpenseBreakdown;
  /** Sobre qué está hecho el desglose: «julio 2026» o «Todo el periodo». */
  alcance?: string;
}) {
  // Sin filas puede ser que no haya gastos… o que el periodo elegido no tenga.
  // En el segundo caso esconder la tarjeta dejaría al usuario sin forma de
  // volver atrás, así que solo se oculta cuando no hay filtro.
  if (data.totalRows === 0) return null;

  const clasificados = data.grupos.filter((g) => g.grupo !== "sin_clasificar");
  const sinClasificar = data.grupos.find((g) => g.grupo === "sin_clasificar");
  const max = Math.max(1, ...clasificados.map((g) => g.amountCRC));

  return (
    <BiCard
      title="En qué se va el gasto"
      /* El alcance va primero: es lo que Esteban preguntó —«¿y por mes?»— y lo
         que antes contestaba un control propio con las mismas cuatro opciones
         que la barra de arriba (A158). */
      subtitle={`${alcance ?? "Todo el periodo"} · ${formatCRC(
        data.totalCRC,
      )} en ${data.totalRows} movimientos · ${data.categorias
        .map((c) => categoryLabel(c))
        .join(" + ")}`}
    >
      {data.totalRows === 0 ? (
        <p className="text-[13px] text-[var(--bi-ink-3)]">
          No hay gastos de estas categorías en el periodo elegido.
        </p>
      ) : null}

      <ul className="space-y-4">
        {clasificados.map((g, i) => (
          <li key={g.grupo}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[14px] font-medium text-[var(--bi-ink)]">
                {NOMBRES[g.grupo] ?? g.grupo}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="bi-num text-[14px] tabular-nums text-[var(--bi-ink)]">
                  {formatCRC(g.amountCRC)}
                </span>
                {/* El porcentaje es sobre el TOTAL; la barra está normalizada
                    al grupo más grande, así que el primero siempre llena el
                    carril. Las proporciones entre barras sí corresponden, pero
                    sin decirlo la más larga se lee como «todo» (A157). */}
                <span className="bi-num text-[11px] tabular-nums text-[var(--bi-ink-3)]">
                  {formatPct(g.pct)}
                </span>
              </span>
            </div>

            <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
              <div
                className="bi-grow-x h-full rounded-full"
                style={{
                  width: `${Math.max((g.amountCRC / max) * 100, 2)}%`,
                  background: "var(--bi-expense)",
                  animationDelay: `${i * 50}ms`,
                }}
              />
            </div>

            {/* Los proveedores del grupo. Es lo que pidió Esteban: sin esto,
                «servicios profesionales» dice ₡6,7 M y no dice de quién. */}
            <ul className="mt-2 space-y-1 border-l border-[var(--bi-ring)] pl-3">
              {g.etiquetas.map((e) => (
                <li
                  key={e.etiqueta}
                  className="flex items-baseline justify-between gap-3 text-[12.5px]"
                >
                  {/* Sin `truncate`: el nombre del proveedor es lo que dice a
                      quién se le pagó, y a 375 px «PRIMER PAGO DASHBOARD»
                      necesitaba 176 px en 165 (A157). Envuelve. */}
                  <span className="min-w-0 break-words text-[var(--bi-ink-3)]">
                    {e.etiqueta}
                    {e.rows > 1 ? <span className="opacity-70"> ×{e.rows}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="bi-num tabular-nums text-[var(--bi-ink-2)]">
                      {formatCRC(e.amountCRC)}
                    </span>
                    {/* Sobre el grupo: contesta «¿cuánto de esto es este
                        proveedor?», que es lo que se pregunta al mirar la
                        lista. Sobre el total no contestaría nada. */}
                    <span className="bi-num w-[46px] text-right tabular-nums text-[11px] text-[var(--bi-ink-3)]">
                      {formatPct(e.pctGrupo)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs leading-relaxed text-[var(--bi-ink-3)]">
        Es la misma plata, agrupada — no cambia la utilidad. Cada proveedor sale
        del renglón con que el gasto entró, así que el total de acá no es el de
        una sola categoría del gráfico de arriba.{" "}
        <b className="text-[var(--bi-ink-2)]">
          Las barras se miden contra el grupo más grande
        </b>
        , no contra el total: por eso el primero llena la barra entera. El
        porcentaje de al lado sí es sobre el total, y dentro de cada grupo el de
        cada proveedor es sobre su grupo.
      </p>

      {sinClasificar ? (
        <div className="mt-3 rounded-xl border border-[var(--bi-expense)]/35 bg-[var(--bi-expense)]/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-[var(--bi-expense)]"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--bi-ink)]">
                {formatCRC(sinClasificar.amountCRC)} sin clasificar
                <span className="ml-1 font-normal text-[var(--bi-ink-3)]">
                  ({formatPct(sinClasificar.pct)} del total)
                </span>
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--bi-ink-2)]">
                Son gastos cuyo renglón todavía no sabemos en qué grupo va.
                Decinos dónde los ponés y los acomodamos:
              </p>
              <ul className="mt-2 space-y-1">
                {data.sinClasificar.map((s) => (
                  <li
                    key={s.etiqueta}
                    className="flex items-baseline justify-between gap-3 text-[12.5px]"
                  >
                    <span className="truncate text-[var(--bi-ink-2)]">
                      {s.etiqueta}
                      {s.rows > 1 ? (
                        <span className="text-[var(--bi-ink-3)]"> ×{s.rows}</span>
                      ) : null}
                    </span>
                    <span className="bi-num shrink-0 tabular-nums text-[var(--bi-ink)]">
                      {formatCRC(s.amountCRC)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </BiCard>
  );
}
