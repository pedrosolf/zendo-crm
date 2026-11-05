import { describe, it, expect } from "vitest";
import { resolverProblema } from "@modules/denuncias/lib/resolver";

/**
 * Caso real (reclamo #1012): el vecino confirmo "Bacheo urbano" y el agente mando
 * problema_id 3, que es "Cable chispeando". Fallo en silencio: el reclamo se registro,
 * en la dependencia equivocada. La categoria tiene que salir del nombre confirmado.
 */
const catalogo = [
  { id: 3, nombre: "Cable chispeando", tipo_id: 1, tipo_nombre: "Alumbrado e iluminación", sinonimos: [] },
  { id: 11, nombre: "Reposición de luminaria", tipo_id: 1, tipo_nombre: "Alumbrado e iluminación", sinonimos: [] },
  { id: 35, nombre: "Bacheo urbano", tipo_id: 5, tipo_nombre: "Calles y veredas", sinonimos: [] },
];

const id = (r: ReturnType<typeof resolverProblema>) => ("problema" in r ? r.problema.id : null);

describe("categoria del reclamo", () => {
  it("si el nombre y el id no coinciden, gana el nombre confirmado", () => {
    expect(id(resolverProblema(catalogo, { problema: "Bacheo urbano", problema_id: 3 }))).toBe(35);
  });

  it("tolera acentos, mayusculas y espacios", () => {
    expect(id(resolverProblema(catalogo, { problema: "reposicion de LUMINARIA " }))).toBe(11);
  });

  it("un nombre inventado no se registra, aunque traiga un id valido", () => {
    const r = resolverProblema(catalogo, { problema: "Luminaria apagada", problema_id: 3 });
    expect(id(r)).toBeNull();
    expect("error" in r && r.error).toContain("no es una categoria");
  });

  it("sin nombre, cae al id", () => {
    expect(id(resolverProblema(catalogo, { problema_id: 35 }))).toBe(35);
    expect(id(resolverProblema(catalogo, {}))).toBeNull();
  });
});
