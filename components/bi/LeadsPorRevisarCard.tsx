"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Info } from "lucide-react";
import { formatDateCR, formatInt } from "@/lib/bi-format";
import { cn } from "@/lib/utils";
import { BiCard } from "./BiCard";
import { BiPager } from "./BiPager";
import type {
  LeadsPorRevisar,
  LeadSinLlave,
  LeadTelefonoRaro,
} from "./types";

const PAGE_SIZE = 10;

/**
 * Motivos en el idioma de Esteban, no en el del backend. `psid` y `no_cr` son
 * códigos estables del backend; acá se traducen una sola vez y en un solo lugar.
 */
const MOTIVO_LABELS: Record<string, string> = {
  psid: "Escribió por Instagram o Messenger",
  no_cr: "Número de otro país",
  placeholder: "Número de relleno",
  primer_digito: "No empieza como número tico",
  longitud: "No tiene 8 dígitos",
  otro: "Sin clasificar",
};

/** La explicación larga: solo se muestra para los motivos que de verdad aparecen. */
const MOTIVO_NOTAS: Record<string, string> = {
  psid: "Lo que quedó guardado no es un teléfono sino un identificador interno de Meta, que es lo único que manda Instagram o Messenger.",
  no_cr: "Trae prefijo internacional de otro país, así que no se puede cruzar contra una revisión hecha en Costa Rica.",
  placeholder: "Un número de relleno (todo ceros o similar) que alguien puso para llenar el campo.",
  primer_digito: "Ocho dígitos, pero empieza por uno que no existe en la numeración tica.",
  longitud: "No llega a ocho dígitos ni con el prefijo quitado.",
  otro: "El backend no lo pudo clasificar. Vale la pena mirarlo a mano.",
};

/**
 * Los caracteres de control bidireccional llegan pegados a algunos teléfonos
 * (WhatsApp los mete al copiar). Si se pintan tal cual, reordenan visualmente
 * el texto que sigue en la celda: se limpian para mostrar, no en el dato.
 */
const limpiarBidi = (s: string) =>
  s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");

/** Copia el ID al portapapeles; si el navegador no deja, el texto es seleccionable igual. */
function CopiarId({ id }: { id: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="bi-num select-all text-[12px] tabular-nums text-[var(--bi-ink-2)]">
        {id}
      </span>
      <button
        type="button"
        aria-label={copiado ? `${id} copiado` : `Copiar ${id}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 1500);
          } catch {
            // Sin permiso de portapapeles no se hace nada: el ID ya está a la
            // vista y con `select-all` se copia de un clic.
          }
        }}
        /* `size-8` y no `p-1`: el icono mide 14px y el objetivo táctil quedaba
           por debajo del mínimo utilizable en teléfono. */
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--bi-ink-3)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
      >
        {copiado ? (
          <Check className="size-3.5" style={{ color: "var(--bi-good)" }} aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
    </span>
  );
}

const THEAD =
  "bi-num px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)]";
const TD = "px-4 py-3 text-[13px]";

/**
 * Lista consultable de los leads que piden acción.
 *
 * Antes el tablero decía "31 sin llave" y ahí se acababa: un número que no se
 * puede accionar. Lo que vuelve útil cada fila es el **ID de Airtable**, porque
 * es donde Esteban va a corregir el registro mientras Airtable siga siendo la
 * fuente. Por eso la columna del ID no es un detalle técnico escondido: es la
 * razón de ser de la tarjeta.
 *
 * `lead_dup` no está acá a propósito (A26: ruido esperado, se marca y no se
 * fusiona). Meterlo ahogaría la lista con ~1.700 filas que nadie debe tocar.
 */
/**
 * `conPeriodo` entra **opcional — A148**: la lista se calcula sobre todos los
 * leads y no la mueve el filtro de arriba, así que hay que decirlo cuando hay
 * uno puesto. Va opcional para no romper la ventana entre despliegues (A115).
 */
export function LeadsPorRevisarCard({
  data,
  conPeriodo = false,
}: {
  data: LeadsPorRevisar;
  conPeriodo?: boolean;
}) {
  const [tab, setTab] = useState<"telefonoRaro" | "sinLlave">("telefonoRaro");
  const [page, setPage] = useState(1);

  const cambiarTab = (t: typeof tab) => {
    setTab(t);
    setPage(1); // sin esto se cae en una página que la otra lista no tiene
  };

  /**
   * Un mismo lead puede estar en las dos listas (un PSID no es teléfono usable
   * Y deja al lead sin llave), así que los avisos no son leads: se dicen los
   * dos números para que 183 no se lea como 183 personas.
   */
  const { avisos, leadsDistintos } = useMemo(() => {
    const ids = new Set<string>();
    for (const l of data.sinLlave) ids.add(l.airtableId);
    for (const l of data.telefonoRaro) ids.add(l.airtableId);
    return {
      avisos: data.sinLlave.length + data.telefonoRaro.length,
      leadsDistintos: ids.size,
    };
  }, [data]);

  const motivosPresentes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of data.telefonoRaro)
      counts.set(l.motivo, (counts.get(l.motivo) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([motivo, rows]) => ({ motivo, rows }));
  }, [data.telefonoRaro]);

  const filas: (LeadSinLlave | LeadTelefonoRaro)[] =
    tab === "sinLlave" ? data.sinLlave : data.telefonoRaro;
  const pageCount = Math.max(1, Math.ceil(filas.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const desde = (pageSafe - 1) * PAGE_SIZE;
  const visibles = filas.slice(desde, desde + PAGE_SIZE);

  const tabs = [
    {
      value: "telefonoRaro" as const,
      label: "Teléfono inservible",
      count: data.telefonoRaro.length,
    },
    { value: "sinLlave" as const, label: "Sin llave", count: data.sinLlave.length },
  ];

  return (
    <BiCard
      className="min-w-0"
      title="Leads por revisar"
      subtitle={
        `${formatInt(avisos)} avisos sobre ${formatInt(leadsDistintos)} leads · ` +
        (conPeriodo
          ? "todo el histórico, no sigue al periodo · corregibles en Airtable"
          : "corregibles en Airtable")
      }
      bodyClassName="pt-0"
    >
      <div
        role="group"
        aria-label="Elegir qué lista de leads por revisar se muestra"
        className="flex flex-wrap items-center gap-1.5 pb-3 pt-4"
      >
        {tabs.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={active}
              onClick={() => cambiarTab(t.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
                active
                  ? "border-[var(--bi-income)] bg-[var(--bi-income)]/12 text-[var(--bi-ink)]"
                  : "border-[var(--bi-ring)] text-[var(--bi-ink-3)] hover:text-[var(--bi-ink-2)]",
              )}
            >
              {t.label}
              <span className="bi-num ml-1.5 text-[var(--bi-ink-3)]">
                {formatInt(t.count)}
              </span>
            </button>
          );
        })}
      </div>

      {filas.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--bi-ink-2)]">
          Nada por revisar en esta lista.
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table
            className={cn(
              "w-full border-collapse text-left",
              tab === "sinLlave" ? "min-w-[440px]" : "min-w-[620px]",
            )}
          >
            <caption className="sr-only">
              {tab === "sinLlave"
                ? "Leads sin teléfono ni ManyChat, con su ID de Airtable"
                : "Leads con un teléfono que no se puede usar, con el motivo y su ID de Airtable"}
            </caption>
            <thead>
              {/* El ID va segundo, pegado al nombre, y no al final: en teléfono
                  la tabla se desplaza y la columna que hay que poder leer sin
                  arrastrar es justamente la que vuelve accionable la fila. */}
              <tr className="border-b border-[var(--bi-ring)]">
                <th scope="col" className={THEAD}>
                  Lead
                </th>
                <th scope="col" className={THEAD}>
                  ID de Airtable
                </th>
                {tab === "telefonoRaro" ? (
                  <>
                    <th scope="col" className={THEAD}>
                      Motivo
                    </th>
                    <th scope="col" className={THEAD}>
                      Guardado
                    </th>
                  </>
                ) : null}
                <th scope="col" className={THEAD}>
                  Entró
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <tr
                  key={l.airtableId}
                  className="border-b border-[var(--bi-ring)]/60 transition-colors last:border-0 hover:bg-[var(--bi-surface-2)]"
                >
                  <td className={cn(TD, "text-[var(--bi-ink)]")}>
                    {/* Que venga sin nombre es lo normal en un lead sin llave:
                        se rotula en vez de dejar la celda vacía. */}
                    {l.name?.trim() || (
                      <span className="text-[var(--bi-ink-3)]">Sin nombre</span>
                    )}
                  </td>
                  <td className={cn(TD, "whitespace-nowrap")}>
                    <CopiarId id={l.airtableId} />
                  </td>
                  {"motivo" in l ? (
                    <>
                      <td className={cn(TD, "text-[var(--bi-ink-2)]")}>
                        {MOTIVO_LABELS[l.motivo] ?? l.motivo}
                      </td>
                      <td className={cn(TD, "bi-num whitespace-nowrap tabular-nums text-[var(--bi-ink-2)]")}>
                        {l.rawPhone ? limpiarBidi(l.rawPhone) : "—"}
                      </td>
                    </>
                  ) : null}
                  <td className={cn(TD, "bi-num whitespace-nowrap text-[var(--bi-ink-2)]")}>
                    {l.sourceCreatedAt ? formatDateCR(l.sourceCreatedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BiPager
        page={pageSafe}
        pageCount={pageCount}
        onChange={setPage}
        summary={
          filas.length === 0
            ? "Sin filas"
            : `Mostrando ${formatInt(desde + 1)}–${formatInt(desde + visibles.length)} de ${formatInt(filas.length)}`
        }
      />

      <div className="mt-3 space-y-2 border-t border-[var(--bi-ring)] pt-3 text-xs leading-relaxed text-[var(--bi-ink-3)]">
        <p>
          Buscá el <strong className="text-[var(--bi-ink-2)]">ID de Airtable</strong>{" "}
          en la base de leads para corregir el registro allá: mientras Airtable
          siga siendo la fuente, arreglarlo acá no serviría de nada.
        </p>
        {tab === "telefonoRaro" ? (
          <>
            {motivosPresentes.map((m) => (
              <p key={m.motivo}>
                <span className="bi-num tabular-nums text-[var(--bi-ink-2)]">
                  {formatInt(m.rows)}
                </span>{" "}
                <span className="text-[var(--bi-ink-2)]">
                  {MOTIVO_LABELS[m.motivo] ?? m.motivo}:
                </span>{" "}
                {MOTIVO_NOTAS[m.motivo] ?? "Sin descripción."}
              </p>
            ))}
            {/* La primera pregunta al ver esta lista es siempre la misma. */}
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Los números <strong className="text-[var(--bi-ink-2)]">+506</strong>{" "}
                de ocho dígitos <strong className="text-[var(--bi-ink-2)]">no</strong>{" "}
                están en esta lista: el sistema les quita el 506 y los da por
                buenos. Acá solo hay números de otros países e identificadores de
                Meta.
              </span>
            </p>
          </>
        ) : (
          <p>
            Sin teléfono ni ManyChat no hay forma de saber si esa persona volvió,
            así que estos leads nunca van a poder contar como conversión.
          </p>
        )}
      </div>
    </BiCard>
  );
}
