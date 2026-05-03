/**
 * `alert` / `confirm` con tipos seguros cuando el check de tipos no expone el DOM.
 */
function getAlert(): ((m: string) => void) | undefined {
  return (globalThis as unknown as { alert?: (m: string) => void }).alert;
}

/**
 * Muestra un `alert` del entorno, si existe.
 */
export function browserAlert(message: string): void {
  getAlert()?.(message);
}

/**
 * `confirm` del navegador
 */
export function browserConfirm(message: string): boolean {
  const g = globalThis as unknown as { confirm?: (m: string) => boolean };
  return g.confirm ? g.confirm(message) : true;
}

/** `window.scrollY` / fallback 0. */
export function getScrollY(): number {
  const w = globalThis as unknown as { scrollY?: number };
  return typeof w.scrollY === "number" ? w.scrollY : 0;
}

/** `e.currentTarget.value` (evita `EventTarget` sin `value` en TS estricto). */
export function formControlValue(
  e: { currentTarget: EventTarget | null },
): string {
  return (e.currentTarget as unknown as { value: string }).value;
}

/** Checkbox `checked`. */
export function formControlChecked(
  e: { currentTarget: EventTarget | null },
): boolean {
  return (e.currentTarget as unknown as { checked: boolean }).checked;
}
