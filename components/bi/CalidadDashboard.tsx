"use client";

import { CheckCircle2, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { BiKpiCard } from "@/components/bi/BiKpiCard";
import { formatInt, formatPct } from "@/lib/bi-format";

export type CalidadData = {
  totalIssues: number;
  sinResolver: number;
  resueltos: number;
  porClase: { accion: number; informativo: number; esperado: number };
  tipos: Array<{
    issueType: string;
    clase: string;
    titulo: string;
    queEs: string;
    queHacer: string;
    sinResolver: number;
    resueltos: number;
    ejemplos: string[];
  }>;
  sinCatalogar: string[];
  cobertura: Array<{
    campo: string;
    presentes: number;
    total: number;
    pct: number;
    faltan: number;
  }>;
  nota: string;
};

const CLASE = {
  accion: {
    label: "Pide acción",
    color: "var(--bi-expense)",
    Icon: CircleAlert,
  },
  informativo: {
    label: "Para saber",
    color: "var(--bi-warn)",
    Icon: Info,
  },
  esperado: {
    label: "Esperado",
    color: "var(--bi-ink-3)",
    Icon: CheckCircle2,
  },
} as const;

type ClaveClase = keyof typeof CLASE;
const claseDe = (c: string): ClaveClase =>
  c === "accion" || c === "informativo" || c === "esperado" ? c : "accion";

/**
 * Tablero de **Calidad de los datos** (F3) — capa 100% presentacional.
 *
 * El número que importa no es cuántos avisos hay: es **cuántos piden algo**. En
 * producción hay 2.158 avisos y 1.869 son duplicados de contacto que se marcan a
 * propósito y no se fusionan (A26). Un tablero que muestre «2.158 problemas»
 * enseña a ignorarse en una semana, y ahí se pierden los pocos que sí importan.
 *
 * Por eso la pantalla se ordena por **qué hacer con cada cosa** y no por
 * severidad ni por volumen: primero lo accionable —aunque sean tres— y el ruido
 * al final, explicado en vez de escondido. Explicarlo importa: si se ocultara,
 * la primera vez que alguien viera el número crudo en otro lado pensaría que le
 * estuvimos tapando 1.869 problemas.
 */
export function CalidadDashboard({ data }: { data: CalidadData }) {
  const porClase = (c: ClaveClase) => data.tipos.filter((t) => claseDe(t.clase) === c);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BiKpiCard
          index={0}
          label="Piden acción"
          value={formatInt(data.porClase.accion)}
          hint={
            data.porClase.accion === 0
              ? "Nada pendiente ahora mismo"
              : "Lo único de esta pantalla que hay que atender"
          }
          tone={data.porClase.accion > 0 ? "expense" : "utilidad"}
        />
        <BiKpiCard
          index={1}
          label="Para saber"
          value={formatInt(data.porClase.informativo)}
          hint="Se registran para poder auditar; no se arreglan"
          tone="warn"
        />
        <BiKpiCard
          index={2}
          label="Ruido esperado"
          value={formatInt(data.porClase.esperado)}
          hint="Duplicados que se marcan a propósito"
          tone="neutral"
        />
        <BiKpiCard
          index={3}
          label="Ya resueltos"
          value={formatInt(data.resueltos)}
          hint={`De ${formatInt(data.totalIssues)} avisos en total`}
          tone="utilidad"
        />
      </div>

      {data.sinCatalogar.length > 0 ? (
        <div className="rounded-2xl border border-[var(--bi-expense)]/40 bg-[var(--bi-expense)]/10 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--bi-expense)]">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            Apareció un tipo de aviso que no habíamos visto
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
            {data.sinCatalogar.join(", ")} — está contado como «pide acción» hasta
            que lo clasifiquemos. Avisanos y lo describimos.
          </p>
        </div>
      ) : null}

      {(["accion", "informativo", "esperado"] as const).map((clase) => {
        const tipos = porClase(clase);
        if (tipos.length === 0) return null;
        const { label, color, Icon } = CLASE[clase];

        return (
          <BiCard
            key={clase}
            title={label}
            subtitle={
              clase === "accion"
                ? "Cosas que conviene mirar"
                : clase === "informativo"
                  ? "Quedan anotadas para poder revisar cómo se decidió algo"
                  : "No son errores: el sistema los marca por diseño"
            }
          >
            <ul className="space-y-4">
              {tipos.map((t) => (
                <li key={t.issueType}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <Icon
                        className="size-4 shrink-0 translate-y-[2px]"
                        style={{ color }}
                        aria-hidden
                      />
                      <span className="min-w-0 text-[14px] font-medium text-[var(--bi-ink)]">
                        {t.titulo}
                      </span>
                    </span>
                    <span className="bi-num shrink-0 tabular-nums text-[14px] text-[var(--bi-ink)]">
                      {formatInt(t.sinResolver)}
                    </span>
                  </div>

                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
                    {t.queEs}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--bi-ink-3)]">
                    <b className="text-[var(--bi-ink-2)]">Qué hacer:</b> {t.queHacer}
                  </p>

                  {t.ejemplos.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 border-l border-[var(--bi-ring)] pl-3">
                      {t.ejemplos.map((e, i) => (
                        <li
                          key={`${t.issueType}-${i}`}
                          className="truncate text-[11.5px] text-[var(--bi-ink-3)]"
                        >
                          {e}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {t.resueltos > 0 ? (
                    <p className="mt-1.5 text-[11.5px] text-[var(--bi-ink-3)]">
                      {formatInt(t.resueltos)} ya resueltos, fuera de la cuenta de
                      arriba.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </BiCard>
        );
      })}

      {/* ------------------------------------------------------------------ */}
      <BiCard
        title="Qué tan completos están los datos"
        subtitle="Los huecos no son errores, pero limitan qué se puede calcular"
      >
        <ul className="space-y-3">
          {data.cobertura.map((c) => (
            <li key={c.campo}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] text-[var(--bi-ink-2)]">
                  {c.campo}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="bi-num text-[13px] tabular-nums text-[var(--bi-ink)]">
                    {formatPct(c.pct)}
                  </span>
                  <span className="bi-num text-[11px] tabular-nums text-[var(--bi-ink-3)]">
                    faltan {formatInt(c.faltan)}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--bi-surface-2)]">
                <div
                  className="bi-grow-x h-full rounded-full"
                  style={{
                    width: `${Math.max(c.pct, 2)}%`,
                    background:
                      c.pct >= 95
                        ? "var(--bi-good)"
                        : c.pct >= 80
                          ? "var(--bi-warn)"
                          : "var(--bi-expense)",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </BiCard>

      <div className="rounded-2xl border border-[var(--bi-ring)] bg-[var(--bi-surface)] p-4 text-[12.5px] leading-relaxed text-[var(--bi-ink-3)] sm:p-5">
        <p>
          <b className="text-[var(--bi-ink-2)]">
            Por qué no ves un número grande de problemas.
          </b>{" "}
          El sistema registra {formatInt(data.totalIssues)} avisos, pero la
          mayoría son duplicados de contacto que marca a propósito: Airtable trae
          a la misma persona varias veces y fusionarlas borraría historial de
          conversación. Se marcan y se dejan. Lo que de verdad pide algo son{" "}
          <b className="text-[var(--bi-ink-2)]">{formatInt(data.porClase.accion)}</b>.
        </p>
        <p className="mt-2">
          <b className="text-[var(--bi-ink-2)]">Cómo se decide qué pide acción.</b>{" "}
          Por una lista escrita, tipo por tipo — no por la etiqueta de gravedad
          que traiga cada aviso. Si aparece un tipo que no está en esa lista, se
          cuenta como que pide acción hasta que lo revisemos, para que no se
          esconda solo.
        </p>
      </div>
    </div>
  );
}
