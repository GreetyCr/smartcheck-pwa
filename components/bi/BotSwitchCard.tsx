"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Bot, Loader2, Power, TriangleAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { BiCard } from "@/components/bi/BiCard";
import { formatDateCR } from "@/lib/bi-format";
import { browserConfirm } from "@/lib/browser-confirm";
import { cn } from "@/lib/utils";

type Estado = {
  enabled: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
  updatedVia: string | null;
  note: string | null;
  isDefault: boolean;
  apiConectada: boolean;
};

/**
 * On/off del bot de WhatsApp — el control que pidió Esteban (B25/A28).
 *
 * Dos decisiones que definen esta pantalla:
 *
 * 1. **No miente sobre su efecto.** Mientras Hans no conecte n8n a Convex,
 *    apagar desde acá no apaga nada: su bot sigue leyendo Airtable. Si la
 *    tarjeta dijera «bot apagado» a secas, Esteban podría creer que dejó de
 *    escribirle a sus clientes cuando no fue así. En un kill-switch esa
 *    confusión ES el daño, así que el aviso va arriba y no en letra chica.
 *
 * 2. **Apagar pide confirmación; encender no.** Apagar el bot detiene la
 *    atención a clientes reales; encenderlo devuelve las cosas a su estado
 *    normal. Poner la misma fricción en los dos lados entrena a la gente a
 *    aceptar sin leer, que es cómo los avisos dejan de servir.
 *
 * El on/off **por-lead** no está acá a propósito: hoy el sync semanal lo pisa
 * (A66/A69). Un interruptor que se revierte solo a los pocos días es peor que
 * no tenerlo.
 */
export function BotSwitchCard({ estado }: { estado: Estado }) {
  const setBotEnabled = useMutation(api.bots.public.setBotEnabled);
  const [guardando, setGuardando] = useState(false);

  const encendido = estado.enabled;

  async function alternar() {
    if (guardando) return;
    if (encendido) {
      const ok = browserConfirm(
        estado.apiConectada
          ? "¿Apagar el bot? Va a dejar de responderles a los clientes en WhatsApp hasta que lo vuelvas a encender."
          : "¿Apagar el bot en el panel? Ojo: todavía no está conectado, así que el bot va a seguir respondiendo igual. Esto solo deja registrada tu decisión.",
      );
      if (!ok) return;
    }
    setGuardando(true);
    try {
      await setBotEnabled({ enabled: !encendido });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <BiCard
      title="Bot de WhatsApp"
      subtitle="Encender o apagar la atención automática"
    >
      <div className="space-y-4">
        {/* El aviso que impide que la tarjeta mienta. Va ARRIBA del botón a
            propósito: si estuviera debajo, quien escanea la tarjeta pulsa
            «Apagar el bot» sin haberlo leído, que es justo el malentendido
            que se quiere evitar. */}
        {!estado.apiConectada ? (
          <div className="flex items-start gap-3 rounded-xl border border-[var(--bi-expense)]/35 bg-[var(--bi-expense)]/10 px-4 py-3">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-[var(--bi-expense)]"
              aria-hidden
            />
            <p className="text-[13px] leading-relaxed text-[var(--bi-ink-2)]">
              <b className="text-[var(--bi-ink)]">
                Todavía no surte efecto.
              </b>{" "}
              El bot sigue funcionando con Airtable, así que este interruptor
              aún no lo detiene. Va a empezar a mandar cuando el ingeniero de
              automatizaciones conecte los bots al sistema nuevo. Mientras
              tanto, acá queda registrada tu decisión.
            </p>
          </div>
        ) : null}

        {/* Estado + interruptor */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl border",
                encendido
                  ? "border-[var(--bi-income)]/40 bg-[var(--bi-income)]/10 text-[var(--bi-income)]"
                  : "border-[var(--bi-ring)] bg-[var(--bi-surface-2)] text-[var(--bi-ink-3)]",
              )}
            >
              <Bot className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--bi-ink)]">
                {encendido ? "Encendido" : "Apagado"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--bi-ink-3)]">
                {estado.isDefault
                  ? "Nunca se ha cambiado desde el panel"
                  : descripcionDelCambio(estado)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={alternar}
            disabled={guardando}
            aria-pressed={encendido}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              encendido
                ? "border-[var(--bi-ring)] text-[var(--bi-ink-2)] hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)]"
                : "border-[var(--bi-income)]/40 bg-[var(--bi-income)]/10 text-[var(--bi-income)] hover:bg-[var(--bi-income)]/20",
            )}
          >
            {guardando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Power className="size-4" aria-hidden />
            )}
            {encendido ? "Apagar el bot" : "Encender el bot"}
          </button>
        </div>

      </div>
    </BiCard>
  );
}

/** «Lo apagaste el 19 ago 2026» / «Lo encendió el bot el …». */
function descripcionDelCambio(estado: Estado): string {
  const cuando = estado.updatedAt ? formatDateCR(estado.updatedAt) : "—";
  const quien =
    estado.updatedVia === "dashboard"
      ? "desde el panel"
      : estado.updatedVia === "api"
        ? "desde los bots"
        : "por el sistema";
  const que = estado.enabled ? "Encendido" : "Apagado";
  const nota = estado.note ? ` · ${estado.note}` : "";
  return `${que} ${quien} el ${cuando}${nota}`;
}
