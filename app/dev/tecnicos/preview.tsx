"use client";

import { ShieldCheck, UserRound, Clock } from "lucide-react";
import { BiCard } from "@/components/bi/BiCard";
import { formatInt } from "@/lib/bi-format";
import { ADMIN_CONTENT_PADDING, ADMIN_THEME_CLASS } from "@/lib/admin-theme";
import { cn } from "@/lib/utils";

/**
 * Revisión visual de **Técnicos y usuarios**.
 *
 * Existe desde el 6-set por dos razones, y la segunda pesa más que la primera:
 *
 * 1. Era una de las dos pantallas sin `/dev`, así que su captura para el manual
 *    había que sacarla a mano y salía **a menor densidad** que las otras nueve.
 * 2. **La pantalla real muestra los correos del equipo.** La captura que se sacó
 *    a mano traía cinco direcciones reales —tres personales y una de un
 *    tercero— y el manual es un documento que se comparte. Acá las identidades
 *    son inventadas.
 *
 * **Se copia el render de la fila en vez de usar `TechnicianRow`**: ese
 * componente llama a `useMutation` para promover, degradar y aprobar usuarios.
 * En `/dev` no hay proveedor de Convex, y ponerlo sería peor: los botones
 * escribirían contra producción desde una página de revisión. Acá los botones
 * son inertes.
 *
 * El precio es que si la fila real cambia de aspecto, hay que cambiarla acá
 * también. Se paga a sabiendas.
 */
type Fila = {
  id: string;
  nombre: string;
  correo: string;
  admin: boolean;
  pendiente: boolean;
  inspecciones: number;
  ultima: string;
};

/**
 * Cinco usuarios inventados con el reparto real: varios administradores que no
 * hacen revisiones y **un solo técnico que las hace casi todas**. Ese contraste
 * es justo lo que el capítulo tiene que explicar —por qué la pantalla se ve
 * «vacía» y eso está bien— así que la muestra no lo puede aplanar.
 */
const FILAS: Fila[] = [
  {
    id: "u1",
    nombre: "Esteban Vargas",
    correo: "esteban@ejemplo.cr",
    admin: true,
    pendiente: false,
    inspecciones: 0,
    ultima: "Ninguna todavía",
  },
  {
    id: "u2",
    nombre: "Marcela Rojas",
    correo: "marcela@ejemplo.cr",
    admin: true,
    pendiente: false,
    inspecciones: 0,
    ultima: "Ninguna todavía",
  },
  {
    id: "u3",
    nombre: "Smart Check",
    correo: "operaciones@ejemplo.cr",
    admin: true,
    pendiente: false,
    inspecciones: 62,
    ultima: "28 ago, 11:17 a. m.",
  },
  {
    id: "u4",
    nombre: "Sergio Jiménez",
    correo: "sergio@ejemplo.cr",
    admin: false,
    pendiente: false,
    inspecciones: 110,
    ultima: "4 sept, 03:16 p. m.",
  },
  {
    id: "u5",
    nombre: "Kevin Solano",
    correo: "kevin@ejemplo.cr",
    admin: false,
    pendiente: true,
    inspecciones: 0,
    ultima: "Ninguna todavía",
  },
];

const ACCION =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-[filter,background-color,transform] disabled:opacity-50";

export function TecnicosPreview() {
  const pendientes = FILAS.filter((f) => !f.admin && f.pendiente).length;

  return (
    <>
      <div className="bg-amber-500/15 px-4 py-2 text-center text-[13px] text-amber-900">
        <strong>Vista de revisión visual</strong> — usuarios y correos
        inventados. Los botones no hacen nada. No existe en producción.
      </div>
      <div className={cn(ADMIN_THEME_CLASS, ADMIN_CONTENT_PADDING, "min-h-dvh")}>
        <div>
          <header className="mb-6">
            <h1 className="bi-display text-[28px] font-bold uppercase leading-none text-[var(--bi-ink)] sm:text-[34px]">
              Técnicos y usuarios
            </h1>
            <p className="bi-num mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--bi-ink-3)]">
              {formatInt(FILAS.length)} usuarios · {formatInt(pendientes)}{" "}
              pendientes de aprobación
            </p>
          </header>

          <BiCard className="overflow-hidden" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <caption className="sr-only">
                  Usuarios del sistema con su rol, actividad e inspecciones
                </caption>
                <thead>
                  <tr className="border-b border-[var(--bi-ring)]">
                    {[
                      { label: "Usuario", cls: "" },
                      { label: "Rol", cls: "" },
                      { label: "Inspecciones", cls: "" },
                      { label: "Última revisión", cls: "hidden lg:table-cell" },
                      { label: "Acciones", cls: "text-right" },
                    ].map((h) => (
                      <th
                        key={h.label}
                        scope="col"
                        className={`bi-num px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--bi-ink-3)] ${h.cls}`}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FILAS.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-[var(--bi-ring)] text-sm last:border-0"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden
                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--bi-plane)] text-sm font-bold text-[var(--bi-ink-3)]"
                          >
                            {f.nombre.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--bi-ink)]">
                              {f.nombre}
                            </p>
                            <p className="truncate text-xs text-[var(--bi-ink-3)]">
                              {f.correo}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              f.admin
                                ? "border-[var(--bi-income)]/45 text-[var(--bi-income)]"
                                : "border-[var(--bi-ring)] text-[var(--bi-ink-2)]",
                            )}
                          >
                            {f.admin ? (
                              <ShieldCheck className="size-3" aria-hidden />
                            ) : (
                              <UserRound className="size-3" aria-hidden />
                            )}
                            {f.admin ? "Administrador" : "Técnico"}
                          </span>
                          {f.pendiente ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--bi-warn)]/50 px-2 py-0.5 text-[11px] font-semibold text-[var(--bi-warn)]">
                              <Clock className="size-3" aria-hidden />
                              Pendiente de aprobación
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="bi-num px-3 py-3 text-[var(--bi-ink)]">
                        {formatInt(f.inspecciones)}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-[var(--bi-ink-3)] lg:table-cell">
                        {f.ultima}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {f.pendiente ? (
                            <button
                              type="button"
                              disabled
                              className={cn(
                                ACCION,
                                "bg-[var(--bi-good)] text-[#06220f]",
                              )}
                            >
                              Aprobar
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled
                            className={cn(
                              ACCION,
                              f.admin
                                ? "border border-[var(--bi-ring)] text-[var(--bi-ink-2)]"
                                : "bg-[var(--bi-income)] text-[#04212b]",
                            )}
                          >
                            {f.admin ? "Quitar admin" : "Hacer admin"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BiCard>
        </div>
      </div>
    </>
  );
}
