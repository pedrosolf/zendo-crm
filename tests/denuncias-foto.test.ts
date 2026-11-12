import { describe, expect, it } from "vitest";
import { fotoAceptada, MAX_BYTES_FOTO } from "../modules/denuncias/lib/portal";

// El bucket `fotos` del portal rechaza otros formatos y mas de 5.000.000 bytes: subir
// algo que no acepta haria fallar el reclamo entero en vez de registrarlo sin foto.
describe("foto del reclamo", () => {
  it("acepta lo mismo que el wizard web", () => {
    for (const m of ["image/jpeg", "image/png", "image/gif"]) expect(fotoAceptada(m, 200_000)).toBe(true);
  });
  it("rechaza webp (stickers), vacias y pesadas", () => {
    expect(fotoAceptada("image/webp", 200_000)).toBe(false);
    expect(fotoAceptada("image/jpeg", 0)).toBe(false);
    expect(fotoAceptada("image/jpeg", MAX_BYTES_FOTO + 1)).toBe(false);
  });
});
