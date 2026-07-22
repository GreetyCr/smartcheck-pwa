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
