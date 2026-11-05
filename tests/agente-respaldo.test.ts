import { describe, expect, it } from "vitest";
import { APIConnectionTimeoutError, APIError } from "openai";
import { esFallaDelProveedor } from "@/lib/agent/fallas";

// Un modelo colgado en el proveedor dejaba al bot mudo: Vercel cortaba la funcion a los
// 60 s y el job quedaba en "processing" sin error. Esto decide cuando probar el respaldo.
describe("esFallaDelProveedor", () => {
  const conStatus = (status: number) => APIError.generate(status, {}, "x", new Headers());

  it("pasa al respaldo si el proveedor no contesta a tiempo", () => {
    expect(esFallaDelProveedor(new APIConnectionTimeoutError())).toBe(true);
  });

  it("pasa al respaldo con 429 y 5xx", () => {
    for (const s of [408, 429, 500, 502, 503, 504]) expect(esFallaDelProveedor(conStatus(s))).toBe(true);
  });

  it("no reintenta errores de la clave o del pedido", () => {
    for (const s of [400, 401, 403, 404, 422]) expect(esFallaDelProveedor(conStatus(s))).toBe(false);
    expect(esFallaDelProveedor(new Error("cualquier cosa"))).toBe(false);
    expect(esFallaDelProveedor(null)).toBe(false);
  });
});
