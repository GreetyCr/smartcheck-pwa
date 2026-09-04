"use client";

import { CircleAlert, Sparkles, TriangleAlert } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import {
  formatCRC,
  formatInt,
  formatMonthLong,
  formatMonthShort,
} from "@/lib/bi-format";
import { cn } from "@/lib/utils";
import type { Reconciliation } from "@/components/bi/types";

/**
 * Conciliación: lo cobrado en la contabilidad contra lo cobrado en las
 * revisiones — la mitad de **RF-05** que estaba calculada, desplegada, probada
 * y **sin una sola pantalla que la leyera**.
 *
 * ## Tres decisiones, y las tres son sobre no mentir
 *
 * **1. La diferencia se espera distinta de cero, y eso se dice arriba.** Los dos
 * lados se fechan a propósito distinto: la revisión por el día en que se hizo y
 * el ingreso por el día en que se entregó el informe, que es cuando se pagó
 * (B27.2). Un tablero que titule «no cuadra» estaría llamando error a un diseño.
 * Lo que se vigila es el **tamaño** de la diferencia, con umbral explícito.
 *
 * **2. El signo separa dos cosas que no son la misma.** `gapAbs = ingresos −
 * revisiones`. Positivo significa que entró plata que ninguna revisión explica
 * —venta de informes, adicionales—, y es lo normal. **Negativo significa que hay
 * revisiones cobradas que no aparecen en la contabilidad**, que es el lado que
 * puede ser plata perdida. Mostrar `|gap%|` metería las dos en la misma bolsa,
 * así que la dirección se rotula con palabras y no solo con un menos.
 *
 * **3. Todavía NO se puede probar que la captura automática concilie mejor.**
 * El plan del proyecto anota ese contraste como su mejor argumento —agosto, que
 * se captura solo, contra julio, importado de la hoja—, pero al leer producción
 * aparece que **agosto es el único mes con captura automática y además es el mes
 * en curso**: su cifra todavía se está moviendo. La tarjeta lo dice con esas
 * palabras en vez de presentar un número provisional como evidencia. Cuando
 * agosto cierre, la comparación se hace sola y esta nota se cae.
 */
export function ConciliacionCard({ data }: { data: Reconciliation }) {
  const { totals, months, thresholdPct } = data;

  const cerrados = months.filter((m) => !m.enCurso);
  const conProblema = cerrados.filter((m) => m.significant);
  const faltantes = cerrados.filter((m) => m.gapAbs < 0 && m.significant);
  const enCurso = months.find((m) => m.enCurso);

  /* El mes de la captura automática, y si ya cerró o sigue vivo. */
  const primerAuto = data.primerMesAutoCaptura;
  const autoTodaviaAbierto =
    primerAuto !== null && enCurso?.yearMonth === primerAuto;
  const autosCerrados = cerrados.filter((m) => m.autoCaptura);

  const estado = faltantes.length > 0
    ? {
        Icon: CircleAlert,
        color: "var(--bi-expense)",
        titulo: `${faltantes.length === 1 ? "Un mes tiene" : `${faltantes.length} meses tienen`} revisiones que no aparecen en la contabilidad`,
      }
    : conProblema.length > 0
      ? {
          Icon: TriangleAlert,
          color: "var(--bi-warn)",
          titulo: `${conProblema.length} ${conProblema.length === 1 ? "mes se pasa" : "meses se pasan"} del ${thresholdPct}% de diferencia`,
        }
      : {
          Icon: Sparkles,
          color: "var(--bi-good)",
          titulo: "Todos los meses cerrados quedan dentro del margen",
        };

  return (
    <BiCard
      title="¿Cuadra lo cobrado con lo revisado?"
      subtitle={`Desde ${formatMonthLong(data.financeStartISO.slice(0, 7))} · se marca a partir de ${thresholdPct}%`}
      action={
        <span className="bi-num shrink-0 text-xs text-[var(--bi-ink-3)]">
          {formatInt(cerrados.length)} meses cerrados
        </span>
      }
    >
      {/* ---------- qué significa, antes de cualquier número ---------- */}
      <p className="text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
        Son <b className="text-[var(--bi-ink)]">dos cuentas independientes</b> de
        la misma plata: lo que dice la contabilidad y lo que suman las revisiones.{" "}
        <b className="text-[var(--bi-ink)]">No tienen que dar igual</b> — la
        revisión se cuenta el día que se hace y el ingreso el día que se entrega
        el informe, que es cuando el cliente pagó. Lo que se vigila es que la
        diferencia no se pase del {thresholdPct}%.
      </p>

      {/* ---------- titular ---------- */}
      <div className="mt-4 flex items-start gap-3 border-t border-[var(--bi-ring)] pt-4">
        <estado.Icon
          className="mt-0.5 size-5 shrink-0"
          style={{ color: estado.color }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[var(--bi-ink)]">
            {estado.titulo}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
            En total, la contabilidad registra{" "}
            <span className="bi-num text-[var(--bi-ink)]">
              {formatCRC(Math.abs(totals.gapAbsMesesCerrados))}
            </span>{" "}
            {totals.gapAbsMesesCerrados >= 0 ? "más" : "menos"} que las
            revisiones en los meses cerrados —un{" "}
            <span className="bi-num text-[var(--bi-ink)]">
              {pctTexto(totals.gapPctMesesCerrados)}
            </span>
            —. {enCurso ? "El mes en curso va aparte, abajo." : null}
          </p>
        </div>
      </div>

      {/* ---------- tabla por mes ---------- */}
      <div className="-mx-1 mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-[13px] sm:min-w-[440px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[var(--bi-ink-3)]">
              <th className="px-1 py-2 text-left font-medium">Mes</th>
              <th className="hidden px-1 py-2 text-right font-medium sm:table-cell">
                Revisiones
              </th>
              <th className="hidden px-1 py-2 text-right font-medium sm:table-cell">
                Contabilidad
              </th>
              <th className="px-1 py-2 text-right font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const falta = m.gapAbs < 0;
              const alerta = m.significant;
              return (
                <tr
                  key={m.yearMonth}
                  className="border-t border-[var(--bi-ring)]"
                >
                  <td className="px-1 py-2">
                    <span className="bi-num text-[var(--bi-ink)]">
                      {formatMonthShort(m.yearMonth)}
                    </span>
                    <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                      {m.autoCaptura ? <Chip tono="good">se captura solo</Chip> : null}
                      {m.enCurso ? <Chip tono="ink">en curso</Chip> : null}
                    </span>
                    <span className="bi-num mt-0.5 block text-[11px] text-[var(--bi-ink-3)]">
                      {formatInt(m.inspectionsCount)} revisiones
                    </span>
                    {/* En angosto los dos montos bajan acá en vez de quedar en
                        columnas fuera de pantalla: con cuatro columnas, la de
                        «Diferencia» —la única que se mira para decidir— caía
                        del lado invisible del scroll. */}
                    <span className="bi-num mt-0.5 block text-[11px] tabular-nums text-[var(--bi-ink-3)] sm:hidden">
                      {formatCRC(m.inspectionsIncome)} vs{" "}
                      {formatCRC(m.financeIncome)}
                    </span>
                  </td>
                  <td className="hidden bi-num px-1 py-2 text-right tabular-nums text-[var(--bi-ink-2)] sm:table-cell">
                    {formatCRC(m.inspectionsIncome)}
                  </td>
                  <td className="hidden bi-num px-1 py-2 text-right tabular-nums text-[var(--bi-ink-2)] sm:table-cell">
                    {formatCRC(m.financeIncome)}
                  </td>
                  <td className="px-1 py-2 text-right">
                    <span
                      className={cn(
                        "bi-num block tabular-nums",
                        m.enCurso
                          ? "text-[var(--bi-ink-3)]"
                          : alerta
                            ? falta
                              ? "font-semibold text-[var(--bi-expense)]"
                              : "font-semibold text-[var(--bi-warn)]"
                            : "text-[var(--bi-ink-2)]",
                      )}
                    >
                      {pctTexto(m.gapPct)}
                    </span>
                    {/* La dirección con palabras: un signo menos no dice cuál
                        de los dos lados es el que falta. */}
                    <span className="block text-[10.5px] leading-tight text-[var(--bi-ink-3)]">
                      {m.enCurso
                        ? `faltan ${formatInt(m.sinEntregar ?? 0)} por entregar`
                        : falta
                          ? "falta en contabilidad"
                          : "de más en contabilidad"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---------- las dos aclaraciones que evitan leerlo mal ---------- */}
      <div className="mt-4 space-y-2 border-t border-[var(--bi-ring)] pt-4">
        {enCurso ? (
          <Nota titulo={`${Mes(enCurso.yearMonth)} todavía no cierra`}>
            Sus revisiones ya se hicieron, pero{" "}
            <b className="text-[var(--bi-ink-2)]">
              {formatInt(enCurso.sinEntregar ?? 0)}
            </b>{" "}
            {(enCurso.sinEntregar ?? 0) === 1
              ? "informe no se ha entregado"
              : "informes no se han entregado"}
            , así que esa plata todavía no entró. Por eso su diferencia no cuenta
            como problema.
          </Nota>
        ) : null}

        {primerAuto === null ? (
          <Nota titulo="Todos los meses son de captura manual">
            Ninguno tiene todavía ingresos que el sistema haya registrado solo al
            entregar el informe.
          </Nota>
        ) : autoTodaviaAbierto && autosCerrados.length === 0 ? (
          <Nota titulo={`${Mes(primerAuto)} es el primer mes que se captura solo`}>
            Es el primero en el que el ingreso lo registra el sistema al
            entregarse el informe, en vez de anotarse a mano.{" "}
            <b className="text-[var(--bi-ink-2)]">
              Pero es el mes en curso, así que su número todavía se está
              moviendo.
            </b>{" "}
            Recién cuando cierre se va a poder comparar de igual a igual contra
            un mes capturado a mano — hasta entonces, cualquier conclusión sobre
            si concilia mejor sería prematura.
          </Nota>
        ) : (
          <Nota titulo="Dos formas de capturar, dos lecturas">
            En los meses capturados a mano la diferencia mide el desfase entre
            dos registros independientes. En los que{" "}
            <b className="text-[var(--bi-ink-2)]">se capturan solos</b> el ingreso
            de la revisión ya entra por sí mismo, así que lo que queda es el
            ingreso que de verdad no viene de una revisión.
          </Nota>
        )}
      </div>
    </BiCard>
  );
}

/* -------------------------------------------------------------------------- */

/** `formatMonthLong` da «agosto 2026», y estas notas empiezan con él. */
function Mes(ym: string): string {
  const t = formatMonthLong(ym);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** `12,34` → `+12,3%`. El signo va siempre: sin él la dirección se pierde. */
function pctTexto(pct: number): string {
  const signo = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${signo}${Math.abs(pct).toFixed(1).replace(".", ",")}%`;
}

function Chip({
  children,
  tono,
}: {
  children: React.ReactNode;
  tono: "good" | "ink";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-[1px] text-[10px] font-medium",
        tono === "good"
          ? "bg-[var(--bi-good)]/12 text-[var(--bi-good)]"
          : "bg-[var(--bi-surface-2)] text-[var(--bi-ink-3)]",
      )}
    >
      {children}
    </span>
  );
}

function Nota({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <p className="text-[12px] leading-relaxed text-[var(--bi-ink-3)]">
      <span className="font-semibold text-[var(--bi-ink-2)]">{titulo}:</span>{" "}
      {children}
    </p>
  );
}
