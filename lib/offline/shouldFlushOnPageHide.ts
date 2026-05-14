/**
 * Safari **bfcache**: `pagehide` con `persisted === true` indica que la página sigue en caché;
 * no conviene `put` a IDB (sesión aún en RAM). `persisted === false` → descarte real.
 */
export function shouldFlushOnPageHide(
  ev: Pick<PageTransitionEvent, "persisted">,
): boolean {
  return !ev.persisted;
}
