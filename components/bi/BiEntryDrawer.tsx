"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  categoryLabel,
  toDateInputValue,
} from "@/lib/bi-format";
import { FORCE_NON_VIATICO } from "@/convex/bi/lib/financeRules";
import type { FinanceEntry, FinanceEntryInput } from "./types";

/**
 * La regla B22 del backend (`lib/financeRules.FORCE_NON_VIATICO`),
 * solo para la experiencia del formulario: en estas categorías el viático no
 * aplica y el control se desactiva. **La autoridad es el backend**, que vuelve
 * a forzarlo al guardar.
 */
/**
 * **La misma lista que el servidor, importada — A144.**
 *
 * Estaba copiada y se había quedado corta: el formulario desactivaba cinco
 * categorías y el backend fuerza siete. En `Comisión` la casilla se dejaba
 * marcar y **el servidor la apagaba en silencio al guardar** — el usuario elige
 * algo, el sistema hace otra cosa y nadie se lo dice.
 *
 * Dos copias de la misma regla en dos capas es la forma más fácil de que se
 * separen; ya pasó con la definición de conversión (A125 · A128).
 */
const FORCED_NON_VIATICO = FORCE_NON_VIATICO;

const LABEL =
  "block text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--bi-ink-3)]";
const FIELD =
  "mt-1.5 w-full rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-plane)] px-3 py-2.5 text-[14px] text-[var(--bi-ink)] outline-none transition-colors placeholder:text-[var(--bi-ink-3)] focus:border-[var(--bi-income)] focus:ring-2 focus:ring-[var(--bi-income)]/30";

/** Control segmentado accesible (radiogroup nativo con apariencia de píldoras). */
function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
  name,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string; color?: string }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset>
      <legend className={LABEL}>{legend}</legend>
      <div className="mt-1.5 flex gap-1 rounded-xl border border-[var(--bi-ring)] bg-[var(--bi-plane)] p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-within:ring-2 focus-within:ring-[var(--bi-income)]",
                active
                  ? "bg-[var(--bi-surface-2)] text-[var(--bi-ink)]"
                  : "text-[var(--bi-ink-3)] hover:text-[var(--bi-ink-2)]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={active}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.color ? (
                <span
                  aria-hidden
                  className="size-2 rounded-[2px]"
                  style={{ background: o.color, opacity: active ? 1 : 0.5 }}
                />
              ) : null}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function BiEntryDrawer({
  open,
  entry,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Si viene, el formulario edita; si es `null`, crea. */
  entry: FinanceEntry | null;
  onClose: () => void;
  onSubmit: (input: FinanceEntryInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("comida");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"CRC" | "USD">("CRC");
  const [fxRate, setFxRate] = useState("");
  const [date, setDate] = useState(() => toDateInputValue(Date.now()));
  const [isViatico, setIsViatico] = useState(false);
  const [note, setNote] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () => (kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
    [kind],
  );

  // Rellena / reinicia al abrir.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    if (entry) {
      setKind(entry.kind);
      setCategory(entry.category);
      setAmount(String(entry.originalAmount ?? entry.amountCRC));
      setCurrency(entry.originalCurrency);
      setFxRate(entry.fxRate ? String(entry.fxRate) : "");
      setDate(toDateInputValue(entry.date));
      setIsViatico(entry.isViatico);
      setNote(entry.note ?? "");
      setTecnico(entry.tecnico ?? "");
      setLocalidad(entry.localidad ?? "");
    } else {
      setKind("expense");
      setCategory("comida");
      setAmount("");
      setCurrency("CRC");
      setFxRate("");
      setDate(toDateInputValue(Date.now()));
      setIsViatico(false);
      setNote("");
      setTecnico("");
      setLocalidad("");
    }
  }, [open, entry]);

  // Si el tipo cambia, la categoría debe seguir siendo válida para ese tipo.
  useEffect(() => {
    if (!categories.includes(category as never)) setCategory(categories[0]);
  }, [categories, category]);

  const viaticoForced = FORCED_NON_VIATICO.has(category) || kind === "income";

  useEffect(() => {
    if (viaticoForced && isViatico) setIsViatico(false);
  }, [viaticoForced, isViatico]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("El monto debe ser un número mayor a 0.");
      return;
    }
    const parsedFx = fxRate ? Number(fxRate.replace(",", ".")) : undefined;
    if (currency === "USD" && (!parsedFx || parsedFx <= 0)) {
      setError("Un movimiento en USD requiere el tipo de cambio (₡ por US$).");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        kind,
        category,
        originalAmount: parsedAmount,
        originalCurrency: currency,
        fxRate: currency === "USD" ? parsedFx : undefined,
        date,
        isViatico,
        note: note.trim() || undefined,
        tecnico: tecnico.trim() || undefined,
        localidad: localidad.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const preview =
    currency === "USD" && fxRate
      ? Math.round(
          Number(amount.replace(",", ".") || 0) *
            Number(fxRate.replace(",", ".") || 0),
        )
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bi-drawer-title"
        className="bi-slide-in relative flex h-full w-full max-w-[440px] flex-col border-l border-[var(--bi-ring)] bg-[var(--bi-surface)] shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--bi-ring)] px-5 py-4">
          <div>
            <h2
              id="bi-drawer-title"
              className="bi-display text-lg font-bold uppercase text-[var(--bi-ink)]"
            >
              {entry ? "Editar movimiento" : "Registrar movimiento"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--bi-ink-3)]">
              {entry
                ? "Los cambios se recalculan al guardar."
                : "Se guarda como captura manual."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="rounded-lg p-1.5 text-[var(--bi-ink-3)] transition-colors hover:bg-white/5 hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)]"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
        >
          <Segmented
            name="bi-kind"
            legend="Tipo"
            value={kind}
            onChange={setKind}
            options={[
              { value: "expense", label: "Gasto", color: "var(--bi-expense)" },
              { value: "income", label: "Ingreso", color: "var(--bi-income)" },
            ]}
          />

          <div>
            <label className={LABEL} htmlFor="bi-cat">
              Categoría
            </label>
            <select
              id="bi-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={FIELD}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="bi-amount">
                Monto
              </label>
              <input
                id="bi-amount"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={cn(FIELD, "bi-num")}
              />
            </div>
            <Segmented
              name="bi-currency"
              legend="Moneda"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "CRC", label: "₡ CRC" },
                { value: "USD", label: "$ USD" },
              ]}
            />
          </div>

          {currency === "USD" ? (
            <div className="bi-fade-up">
              <label className={LABEL} htmlFor="bi-fx">
                Tipo de cambio (₡ por US$)
              </label>
              <input
                id="bi-fx"
                inputMode="decimal"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                placeholder="510"
                className={cn(FIELD, "bi-num")}
              />
              {preview ? (
                <p className="bi-num mt-1.5 text-xs text-[var(--bi-ink-3)]">
                  Se registrará como ₡{preview.toLocaleString("es-CR")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className={LABEL} htmlFor="bi-date">
              Fecha
            </label>
            <input
              id="bi-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(FIELD, "bi-num")}
            />
          </div>

          <label
            className={cn(
              "flex items-start gap-3 rounded-xl border border-[var(--bi-ring)] p-3 transition-colors",
              viaticoForced
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-[var(--bi-surface-2)]",
            )}
          >
            <input
              type="checkbox"
              checked={isViatico}
              disabled={viaticoForced}
              onChange={(e) => setIsViatico(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--bi-income)]"
            />
            <span>
              <span className="block text-[13px] font-medium text-[var(--bi-ink)]">
                Es viático
              </span>
              <span className="mt-0.5 block text-xs text-[var(--bi-ink-3)]">
                {viaticoForced
                  ? kind === "income"
                    ? "No aplica a ingresos."
                    : "Esta categoría no cuenta como viático."
                  : "Cuenta en el control de viáticos."}
              </span>
            </span>
          </label>

          {!viaticoForced && kind === "expense" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor="bi-tec">
                  Técnico
                </label>
                <input
                  id="bi-tec"
                  value={tecnico}
                  onChange={(e) => setTecnico(e.target.value)}
                  placeholder="Opcional"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="bi-loc">
                  Localidad
                </label>
                <input
                  id="bi-loc"
                  value={localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                  placeholder="Opcional"
                  className={FIELD}
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className={LABEL} htmlFor="bi-note">
              Nota
            </label>
            <textarea
              id="bi-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Opcional"
              className={cn(FIELD, "resize-none")}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="bi-fade-up rounded-xl border border-[var(--bi-bad)]/40 bg-[var(--bi-bad)]/10 px-3 py-2.5 text-[13px] text-[var(--bi-bad)]"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-auto flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--bi-ring)] px-4 py-2.5 text-[14px] font-medium text-[var(--bi-ink-2)] transition-colors hover:bg-[var(--bi-surface-2)] hover:text-[var(--bi-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[var(--bi-income)] px-4 py-2.5 text-[14px] font-semibold text-[#06222a] transition-[filter,transform] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bi-income)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bi-surface)] active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {saving ? "Guardando…" : entry ? "Guardar cambios" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
