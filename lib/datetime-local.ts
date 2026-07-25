/** Valor para `<input type="datetime-local">` en zona horaria local. */
export function toDatetimeLocalValue(ms: number | undefined | null): string {
  if (ms == null || !Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parsea valor de `datetime-local` a ms epoch; vacío → undefined. */
export function fromDatetimeLocalValue(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const t = new Date(trimmed).getTime();
  return Number.isFinite(t) ? t : undefined;
}

/** True si el valor local es posterior a `nowMs` (inicio en el futuro). */
export function isInspectionStartAtInFuture(
  localValue: string,
  nowMs: number = Date.now(),
): boolean {
  const t = fromDatetimeLocalValue(localValue);
  if (t == null) return false;
  return t > nowMs;
}

/**
 * Si el valor está en el futuro, lo recorta a `nowMs` (minuto local).
 * Vacío o inválido se deja igual.
 */
export function clampInspectionStartAtLocal(
  localValue: string,
  nowMs: number = Date.now(),
): string {
  const trimmed = localValue.trim();
  if (!trimmed) return localValue;
  if (!isInspectionStartAtInFuture(trimmed, nowMs)) return localValue;
  return toDatetimeLocalValue(nowMs);
}
