"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { formatCRC, formatInt, formatIsoDateCR } from "@/lib/bi-format";

export type PagosTecnico = {
  yearMonth: string;
  tecnicos: Array<{
    clerkId: string;
    nombre: string;
    revisiones: number;
    revisionesConComision: number;
    viaticosCRC: number;
    comisionCRC: number;
    semanas: Array<{ lunes: string; revisiones: number; viaticosCRC: number }>;
  }>;
  comisionTotalCRC: number;
  viaticosTotalCRC: number;
  revisionesDeOtros: number;
  tarifas: {
    viaticoPorRevision: number;
    comisionPorRevision: number;
    revisionesSinComision: number;
  };
  confiable: boolean;
  enCurso: boolean;
  aviso: string | null;
};

/**
 * Viáticos y comisión del técnico, calculados (**B36**).
 *
 * Reemplaza dos cuentas que Esteban hacía a mano todos los meses. La tarjeta
 * **no escribe nada**: muestra el número y ofrece pasarlo al campo de
 * comisiones. Es a propósito — el cálculo depende de que cada revisión esté
 * atribuida a quien la hizo, y esa es la parte que puede fallar sin avisar.
 *
 * Tres cosas que la tarjeta dice y que el número solo no diría:
 *
 * 1. **De cuántas revisiones sale**, y cuántas de esas llevan comisión. Sin eso
 *    es un monto que hay que creer.
 * 2. **El desglose por semana**, que es como él paga los viáticos por tanda:
 *    permite contrastar contra lo que ya entregó sin rehacer la cuenta.
 * 3. **Cuántas revisiones del mes NO son del técnico.** Son las que hace
 *    Esteban, y son exactamente la diferencia que lo tenía confundido: nosotros
 *    veíamos 46 en julio y él contaba 32.
 */
export function TecnicoPagosCard({
  data,
  onUsarComision,
}: {
  data: PagosTecnico;
  /** Pasa la comisión al campo de la planilla. Sin esto, la tarjeta solo informa. */
  onUsarComision?: (montoCRC: number) => void;
}) {
  const { tarifas } = data;
  const conRevisiones = data.tecnicos.filter((t) => t.revisiones > 0);

  return (
    <BiCard
      title="Viáticos y comisión del técnico"
      subtitle={`₡${formatInt(tarifas.viaticoPorRevision)} por revisión desde la primera · ₡${formatInt(
        tarifas.comisionPorRevision,
      )} a partir de la ${tarifas.revisionesSinComision + 1} del mes`}
    >
      {!data.confiable && data.aviso ? (
        <div className="mb-4 rounded-xl border border-[var(--bi-warn)]/40 bg-[var(--bi-warn)]/10 px-4 py-3">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--bi-warn)]">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Este mes no se puede calcular completo
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
            {data.aviso}
          </p>
        </div>
      ) : null}

      {conRevisiones.length === 0 ? (
        <p className="text-xs text-[var(--bi-ink-3)]">
          El técnico no tiene revisiones en este mes.
        </p>
      ) : (
        <div className="space-y-5">
          {conRevisiones.map((t) => (
            <div key={t.clerkId}>
              <p className="text-[14px] font-medium text-[var(--bi-ink)]">
                {t.nombre}
              </p>

              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--bi-ring)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--bi-ink-3)]">
                    Viáticos
                  </p>
                  <p className="bi-num mt-0.5 text-[19px] font-bold tabular-nums text-[var(--bi-ink)]">
                    {formatCRC(t.viaticosCRC)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--bi-ink-3)]">
                    {formatInt(t.revisiones)} revisiones × ₡
                    {formatInt(tarifas.viaticoPorRevision)}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--bi-ring)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--bi-ink-3)]">
                    Comisión
                  </p>
                  <p className="bi-num mt-0.5 text-[19px] font-bold tabular-nums text-[var(--bi-ink)]">
                    {formatCRC(t.comisionCRC)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--bi-ink-3)]">
                    {t.revisionesConComision > 0
                      ? `${formatInt(t.revisionesConComision)} por encima de las primeras ${
                          tarifas.revisionesSinComision
                        } × ₡${formatInt(tarifas.comisionPorRevision)}`
                      : `no llega a las ${tarifas.revisionesSinComision + 1} que hacen falta`}
                  </p>
                </div>
              </div>

              {/* Por semana: es como él paga los viáticos, por tanda. */}
              <ul className="mt-3 space-y-1 border-l border-[var(--bi-ring)] pl-3">
                {t.semanas.map((w) => (
                  <li
                    key={w.lunes}
                    className="flex items-baseline justify-between gap-3 text-[12.5px]"
                  >
                    <span className="text-[var(--bi-ink-3)]">
                      Semana del {formatIsoDateCR(w.lunes)}
                      <span className="opacity-70"> · {w.revisiones} rev.</span>
                    </span>
                    <span className="bi-num shrink-0 tabular-nums text-[var(--bi-ink-2)]">
                      {formatCRC(w.viaticosCRC)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {onUsarComision && data.comisionTotalCRC > 0 ? (
            <button
              type="button"
              onClick={() => onUsarComision(data.comisionTotalCRC)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--bi-income)]/40 bg-[var(--bi-income)]/10 px-4 text-sm font-semibold text-[var(--bi-income)] transition-colors hover:bg-[var(--bi-income)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
            >
              Usar {formatCRC(data.comisionTotalCRC)} como comisiones del mes
              <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      )}

      {/* El mes en curso, dicho antes que la letra chica: la pantalla abre en
          el mes de hoy, así que un día 2 lo primero que se ve es una comisión en
          ₡0 —la comisión arranca en la revisión 46 del mes—, y ese cero se lee
          como que el cálculo no corrió (A120). */}
      {data.enCurso ? (
        <p className="mt-4 rounded-xl border border-[var(--bi-ring)] px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--bi-ink-2)]">
          <b className="text-[var(--bi-ink)]">Este mes todavía va corriendo.</b>{" "}
          El cálculo se rehace solo con cada revisión nueva, así que este número
          sube hasta que el mes cierre — no hay nada que ejecutar a fin de mes. Y
          la <b>comisión arranca en la revisión {formatInt(
            data.tarifas.revisionesSinComision + 1,
          )}</b>{" "}
          del mes: las primeras semanas marca ₡0 <b>por regla, no por error</b>.
        </p>
      ) : null}

      <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-[11.5px] leading-relaxed text-[var(--bi-ink-3)]">
        La semana va de <b className="text-[var(--bi-ink-2)]">lunes a domingo</b> y
        cuenta en el mes en que empezó — por eso un fin de mes puede caer en el
        mes anterior.
        {data.revisionesDeOtros > 0 ? (
          <>
            {" "}
            Este mes hay{" "}
            <b className="text-[var(--bi-ink-2)]">
              {formatInt(data.revisionesDeOtros)} revisiones que no son del
              técnico
            </b>
            ; esas no generan viático ni comisión.
          </>
        ) : null}{" "}
        Nada de esto se guarda solo: los montos se registran cuando vos los
        confirmás.
      </p>
    </BiCard>
  );
}
