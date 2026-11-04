import { describe, it, expect } from "vitest";
import { coseno, detectarTipo, fragmentar, puntajePalabras, puntuar } from "@/lib/conocimiento/puro";

/**
 * Base de conocimiento (specs/nucleo/13). Lo que falla en silencio: un fragmento cortado a
 * mitad de palabra que el modelo no entiende, un binario aceptado como texto, y sobre todo
 * la busqueda que no encuentra nada cuando el modelo de embeddings gratuito se cae (D4):
 * el agente inventaria el precio.
 */

const enc = (s: string) => new TextEncoder().encode(s);

describe("tipo de archivo por contenido", () => {
  it("reconoce PDF por la firma y no por la extension", () => {
    expect(detectarTipo(enc("%PDF-1.7\n..."), "catalogo.bin")).toBe("application/pdf");
    expect(detectarTipo(enc("<html>no soy pdf</html>"), "catalogo.pdf")).toBe("text/plain");
  });

  it("acepta texto y markdown, rechaza binarios y vacios", () => {
    expect(detectarTipo(enc("# Precios\n- Zapatilla: $85.000"), "lista.md")).toBe("text/markdown");
    expect(detectarTipo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), "foto.txt")).toBeNull();
    expect(detectarTipo(new Uint8Array([0x48, 0x00, 0x49]), "x.txt")).toBeNull();
    expect(detectarTipo(new Uint8Array(), "x.txt")).toBeNull();
  });
});

describe("fragmentar", () => {
  const parrafo = "La zapatilla de running modelo Veloz cuesta 85.000 pesos y viene en talles 38 a 45. ";

  it("un texto corto es un solo fragmento", () => {
    expect(fragmentar("Hola mundo")).toEqual(["Hola mundo"]);
    expect(fragmentar("   \n\n ")).toEqual([]);
  });

  it("parte un texto largo con solape y sin cortar palabras", () => {
    const texto = parrafo.repeat(60);
    const fr = fragmentar(texto, 1200, 200);
    expect(fr.length).toBeGreaterThan(3);
    for (const f of fr) {
      expect(f.length).toBeLessThanOrEqual(1200);
      expect(f.split(" ")[0]).toMatch(/^[A-Za-z0-9.]+$/);
    }
    // Solape: el final de un fragmento reaparece al principio del siguiente.
    const cola = fr[0].slice(-80);
    expect(fr[1].includes(cola.slice(cola.indexOf(" ") + 1, cola.indexOf(" ") + 30))).toBe(true);
  });

  it("une palabras partidas por guion de fin de linea", () => {
    expect(fragmentar("precio de la zapa-\ntilla")).toEqual(["precio de la zapatilla"]);
  });
});

describe("busqueda", () => {
  const catalogo = [
    { contenido: "Zapatillas de running Veloz: $85.000. Talles 38 al 45.", embedding: null },
    { contenido: "Horario de atencion: lunes a viernes de 9 a 18 hs.", embedding: null },
    { contenido: "Envios a todo el pais por correo, demora 3 a 5 dias.", embedding: null },
  ];

  it("sin embeddings, las palabras encuentran el fragmento correcto (CA-005)", () => {
    const consulta = "cuanto salen las zapatillas para running?";
    const orden = catalogo.map((c) => puntuar(consulta, null, c));
    expect(orden[0]).toBeGreaterThan(orden[1]);
    expect(orden[0]).toBeGreaterThan(orden[2]);
    expect(puntajePalabras("horarios de atencion", catalogo[1].contenido)).toBeGreaterThan(0.5);
  });

  it("coseno: iguales 1, ortogonales 0, tamanos distintos 0", () => {
    expect(coseno([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(coseno([1, 0], [0, 1])).toBe(0);
    expect(coseno([1, 2], [1, 2, 3])).toBe(0);
  });

  it("con vectores, manda la semantica aunque no compartan palabras", () => {
    const q = [1, 0, 0];
    const cerca = puntuar("calzado para correr", q, { contenido: "Zapatillas Veloz", embedding: [0.9, 0.1, 0] });
    const lejos = puntuar("calzado para correr", q, { contenido: "Horario de atencion", embedding: [0, 0, 1] });
    expect(cerca).toBeGreaterThan(lejos);
  });
});
