import { describe, it, expect } from "vitest";
import { aFormatoDeCanal } from "@/lib/agent/formato";

/**
 * Lo que escribe el agente sale tal cual al canal. Los modelos meten Markdown aunque el
 * prompt lo prohiba, y el vecino ve "**#1011**" en WhatsApp. Falla en silencio: el mensaje
 * se entrega, solo que se ve mal.
 */
describe("formato del agente por canal", () => {
  it("WhatsApp: negrita doble a simple, sin tocar la simple", () => {
    expect(aFormatoDeCanal("Tu codigo es **#1011**.", "whatsapp")).toBe("Tu codigo es *#1011*.");
    expect(aFormatoDeCanal("Ya es *negrita*", "whatsapp")).toBe("Ya es *negrita*");
    expect(aFormatoDeCanal("~~viejo~~ __ojo__", "whatsapp")).toBe("~viejo~ *ojo*");
  });

  it("vinetas con asterisco pasan a guion para no leerse como negrita", () => {
    expect(aFormatoDeCanal("Requisitos:\n* DNI\n* Foto", "whatsapp")).toBe("Requisitos:\n- DNI\n- Foto");
  });

  it("titulos y links", () => {
    expect(aFormatoDeCanal("## Horarios\nLunes", "whatsapp")).toBe("*Horarios*\nLunes");
    expect(aFormatoDeCanal("Mira [la web](https://muni.gob.ar)", "whatsapp")).toBe("Mira la web: https://muni.gob.ar");
  });

  it("Instagram y Messenger no tienen formato: se quitan las marcas", () => {
    expect(aFormatoDeCanal("Codigo **#1011** y *listo*", "instagram")).toBe("Codigo #1011 y listo");
    expect(aFormatoDeCanal("## Hola", "facebook")).toBe("Hola");
  });

  it("no rompe texto sin Markdown ni precios con asterisco suelto", () => {
    expect(aFormatoDeCanal("Sale $18.500 y la renovacion $12.000", "whatsapp")).toBe("Sale $18.500 y la renovacion $12.000");
    expect(aFormatoDeCanal("2 * 3 = 6", "instagram")).toBe("2 * 3 = 6");
  });
});
