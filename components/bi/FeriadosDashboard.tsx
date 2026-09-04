"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarDays, Info } from "lucide-react";
import { formatInt } from "@/lib/bi-format";
import { cn } from "@/lib/utils";
import { BiCard } from "./BiCard";
import type { FeriadoDelAnio, FeriadosPanel } from "./types";

/**
 * Calendario de feriados de Costa Rica — **RF-20 · RF-21 · RF-22** (A117).
 *
 * ## Lo que ordena la pantalla
 *
 * Arriba **los próximos**, porque es lo único accionable: un calendario del año
 * entero se mira una vez y no se vuelve, pero «faltan 14 días y es de pago
 * obligatorio» cambia lo que uno hace esta semana.
 *
 * Cada feriado dice **de qué tipo es y qué implica**, no solo su nombre. La
 * distinción de RF-21 no es una etiqueta de color: es la diferencia entre pagar
 * sencillo y pagar doble, y por eso va escrita con palabras al lado.
 *
 * ## Los días que ya pasaron llevan lo que pasó
 *
 * Si ese día se hicieron revisiones, se dicen. Es lo que convierte el almanaque
 * en algo que Esteban no podía saber solo: él paga por revisión, así que un
 * feriado obligatorio trabajado es plata que la ley manda pagar doble y que en
 * su hoja no aparece marcada por ningún lado.
 */
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-09-15" → "15 de setiembre". El año ya lo dice el selector. */
function diaYMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} de ${MESES[Number(m) - 1]}`;
}

/** "2026-09-01" → "1 de setiembre de 2026". */
function fechaLarga(iso: string): string {
  return `${diaYMes(iso)} de ${iso.slice(0, 4)}`;
}

function Etiqueta({ tipo }: { tipo: string }) {
  const obligatorio = tipo === "obligatorio";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]",
        obligatorio
          ? "border-[var(--bi-income)]/40 text-[var(--bi-income)]"
          : "border-[var(--bi-ring)] text-[var(--bi-ink-3)]",
      )}
    >
      {obligatorio ? "Pago obligatorio" : "Pago no obligatorio"}
    </span>
  );
}

export function FeriadosDashboard({
  panel,
  onCambiarAnio,
}: {
  panel: FeriadosPanel;
  onCambiarAnio: (anio: number) => void;
}) {
  const porMes = useMemo(() => {
    /* El tipo se nombra en vez de derivarlo de `panel`: `typeof panel.delAnio`
       le hace ver al linter una dependencia del objeto entero, y el memo se
       recalcularía con cualquier campo que cambie. */
    const m = new Map<number, FeriadoDelAnio[]>();
    for (const f of panel.delAnio) {
      const mes = Number(f.fecha.slice(5, 7));
      m.set(mes, [...(m.get(mes) ?? []), f]);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [panel.delAnio]);

  const trabajadosObligatorio = useMemo(
    () =>
      panel.delAnio.filter(
        (f) => f.tipo === "obligatorio" && f.revisiones > 0,
      ),
    [panel.delAnio],
  );

  return (
    <div>
      <header className="mb-6">
        <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
          Feriados
        </h1>
        <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
          {/* En palabras y sin partirse: «2026-09-01» se cortaba a la mitad a
              375px, y además es formato de máquina en una pantalla que la lee
              alguien que no es experto. */}
          Costa Rica · lista verificada al{" "}
          <span className="whitespace-nowrap">
            {fechaLarga(panel.verificadoAl)}
          </span>
        </p>
      </header>

      {/* ---------- RF-22: lo próximo, que es lo accionable ---------- */}
      <BiCard
        title="Lo que viene"
        subtitle="Los tres próximos feriados, contados desde hoy"
      >
        {panel.proximos.length === 0 ? (
          <p className="text-sm text-[var(--bi-ink-3)]">
            No quedan feriados en los años que el panel conoce.
          </p>
        ) : (
          <ul className="space-y-3">
            {panel.proximos.map((f, i) => (
              <li
                key={f.fecha}
                className={cn(
                  "flex flex-wrap items-baseline gap-x-3 gap-y-1",
                  i > 0 && "border-t border-[var(--bi-ring)] pt-3",
                )}
              >
                <CalendarDays
                  className="size-4 shrink-0 self-center text-[var(--bi-ink-3)]"
                  aria-hidden
                />
                <span className="text-[15px] font-medium text-[var(--bi-ink)]">
                  {f.nombre}
                </span>
                <span className="text-[13px] text-[var(--bi-ink-2)]">
                  {f.diaSemana} {diaYMes(f.fecha)}
                </span>
                <span className="bi-num text-[13px] text-[var(--bi-ink-2)]">
                  {f.faltanDias === 0
                    ? "— es hoy"
                    : f.faltanDias === 1
                      ? "— mañana"
                      : `— faltan ${formatInt(f.faltanDias)} días`}
                </span>
                <Etiqueta tipo={f.tipo} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs leading-relaxed text-[var(--bi-ink-3)]">
          En un feriado de <strong>pago obligatorio</strong> el día se paga
          aunque no se trabaje, y <strong>si se trabaja se paga doble</strong>
          {" "}(Código de Trabajo, art. 152). En uno de{" "}
          <strong>pago no obligatorio</strong>, si no se trabaja no se paga, y si
          se trabaja se paga sencillo salvo que se haya acordado otra cosa.
        </p>
      </BiCard>

      {/* ---------- lo que ya pasó, con lo que pasó ---------- */}
      {trabajadosObligatorio.length > 0 ? (
        <BiCard
          className="mt-4"
          title="Feriados que se trabajaron"
          subtitle="De pago obligatorio, en el año que se está viendo"
        >
          <ul className="space-y-2.5">
            {trabajadosObligatorio.map((f) => (
              <li key={f.fecha} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <AlertTriangle
                  className="size-4 shrink-0 self-center text-[var(--bi-warn)]"
                  aria-hidden
                />
                <span className="text-[13px] text-[var(--bi-ink)]">
                  {f.nombre}, {f.diaSemana} {diaYMes(f.fecha)}:
                </span>
                <span className="bi-num text-[13px] font-semibold text-[var(--bi-ink)]">
                  {formatInt(f.revisiones)}{" "}
                  {f.revisiones === 1 ? "revisión" : "revisiones"}
                </span>
                {f.revisionesApp > 0 && f.revisionesHistorico > 0 ? (
                  <span className="text-[12px] text-[var(--bi-ink-3)]">
                    ({formatInt(f.revisionesApp)} en la app,{" "}
                    {formatInt(f.revisionesHistorico)} del CRM viejo)
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {/**
           * **Este texto decía lo contrario hasta el 4-set, y quedó viejo — A132.**
           *
           * Decía que el panel «no calcula cuánto habría que pagar de más, y es
           * a propósito». Era cierto hasta que A129 puso la línea de recargo en
           * Planilla, y no se actualizó al construirla. Una pantalla que declara
           * un límite que ya no existe **manda a alguien a hacer a mano una
           * cuenta que el sistema ya hace**, y encima le quita confianza al
           * resto de lo que la pantalla afirma.
           *
           * Apareció recorriendo el panel como lo recorrería alguien que no lo
           * conoce, no revisando el código.
           */}
          <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs leading-relaxed text-[var(--bi-ink-3)]">
            El recargo por trabajar estos días <strong>lo calcula la planilla</strong>:
            cada feriado obligatorio trabajado suma un día de salario
            (salario ÷ 30), que es lo que falta para llegar al doble, porque el
            salario del mes ya paga ese día. Entrá a <strong>Planilla</strong>, elegí
            el mes y confirmá el número de días — ahí podés ponerlo en medio día si
            se trabajó media jornada. Las comisiones no se duplican: se pagan por
            revisión, no por día.
          </p>
        </BiCard>
      ) : null}

      {/* ---------- RF-20: el calendario ---------- */}
      <BiCard
        className="mt-4"
        title={`Calendario ${panel.anio}`}
        subtitle="Los doce feriados del año, en su fecha exacta"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {panel.aniosCubiertos.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onCambiarAnio(a)}
              aria-pressed={a === panel.anio}
              className={cn(
                "bi-num min-h-9 rounded-xl border px-3 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
                a === panel.anio
                  ? "border-[var(--bi-income)] text-[var(--bi-ink)]"
                  : "border-[var(--bi-ring)] text-[var(--bi-ink-2)] hover:bg-[var(--bi-surface-2)]",
              )}
            >
              {a}
            </button>
          ))}
        </div>

        {!panel.cubierto ? (
          /* Un año sin datos y un año sin feriados se ven igual. Decirlo es la
             diferencia entre «no sé» y una mentira tranquila (A64/A88). */
          <div className="flex gap-2.5 rounded-xl border border-[var(--bi-warn)]/30 p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--bi-warn)]" aria-hidden />
            <p className="text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
              <strong>El panel no tiene la lista de {panel.anio}.</strong> No
              quiere decir que no haya feriados: quiere decir que todavía no se
              cargaron. La lista se escribe a mano contra la publicación del
              Ministerio de Trabajo, porque cambia por ley y no por calendario.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {porMes.map(([mes, dias]) => (
              <li key={mes}>
                <p className="bi-num mb-2 text-[10px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
                  {MESES[mes - 1]}
                </p>
                <ul className="space-y-2">
                  {dias.map((f) => (
                    <li
                      key={f.fecha}
                      className={cn(
                        "flex flex-wrap items-baseline gap-x-2.5 gap-y-1",
                        f.pasado && "opacity-70",
                      )}
                    >
                      <span className="bi-num w-8 shrink-0 text-right text-[15px] font-semibold text-[var(--bi-ink)]">
                        {Number(f.fecha.slice(8))}
                      </span>
                      <span className="min-w-0 text-[13px] text-[var(--bi-ink)]">
                        {f.nombre}
                      </span>
                      <span className="text-[12px] text-[var(--bi-ink-3)]">
                        {f.diaSemana}
                      </span>
                      <Etiqueta tipo={f.tipo} />
                      {f.revisiones > 0 ? (
                        <span className="bi-num text-[12px] text-[var(--bi-warn)]">
                          {formatInt(f.revisiones)}{" "}
                          {f.revisiones === 1 ? "revisión" : "revisiones"}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 border-t border-[var(--bi-ring)] pt-3 text-xs leading-relaxed text-[var(--bi-ink-3)]">
          Son <strong>nueve de pago obligatorio y tres de pago no obligatorio</strong>,
          y en {panel.anio} <strong>ninguno se traslada al lunes</strong>: la
          reforma que los movía por el turismo caducó en 2024. Dos cambios que
          suelen arrastrarse de listas viejas: el <strong>12 de octubre dejó de
          ser feriado</strong> (Ley 9803) y en su lugar entró el 1.º de diciembre.
        </p>
      </BiCard>

      <p className="mt-4 text-xs text-[var(--bi-ink-3)]">
        En total, {formatInt(panel.revisionesEnObligatorio)}{" "}
        {panel.revisionesEnObligatorio === 1 ? "revisión" : "revisiones"} de toda
        la historia {panel.revisionesEnObligatorio === 1 ? "cayó" : "cayeron"} en
        un feriado de pago obligatorio, y{" "}
        {formatInt(panel.revisionesEnNoObligatorio)} en uno de pago no
        obligatorio.
      </p>
    </div>
  );
}
