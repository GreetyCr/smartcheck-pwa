/**
 * UUID estable de borrador en URL y sync (local-first).
 * Evita mezclar con `Id<"inspections">`, `clerkId` o `clientPhotoId`.
 */
export type ClientId = string & { readonly __brand: "ClientId" };

export function ClientId(value: string): ClientId {
  return value as ClientId;
}
