/**
 * Fallas del proveedor que justifican probar otro modelo: tiempo agotado, red, 429 y 5xx.
 * Un 400/401/404 no: es la clave o el pedido, y el respaldo fallaria igual.
 */
export function esFallaDelProveedor(err: unknown): boolean {
  const e = err as { status?: number; name?: string; constructor?: { name?: string } } | null;
  if (!e) return false;
  // El SDK de openai deja `name` en "Error"; la clase es la que dice que paso.
  const nombre = `${e.name ?? ""} ${e.constructor?.name ?? ""}`;
  if (/Timeout|Connection|Abort/i.test(nombre)) return true;
  const status = typeof e.status === "number" ? e.status : undefined;
  if (status === undefined) return false;
  return status === 408 || status === 429 || status >= 500;
}
