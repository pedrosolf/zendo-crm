import { describe, expect, it } from "vitest";
import { coordenadasDe, textoDeAudio, textoDeFoto, textoDeUbicacion } from "@/lib/channels/medios";

// El agente solo lee texto: si el pin o el audio entran como "[mensaje]", el vecino que
// manda su ubicacion o una nota de voz no recibe respuesta util y nadie se entera.
describe("medios de WhatsApp como texto", () => {
  it("el pin entra con coordenadas y vuelven a salir iguales", () => {
    const t = textoDeUbicacion({ latitude: -27.4853268, longitude: -58.8435436, name: "Plaza", address: "Balboa 2475" });
    expect(t).toBe("📍 Ubicacion compartida: -27.485327,-58.843544 (Plaza - Balboa 2475)");
    expect(coordenadasDe(t)).toEqual({ lat: -27.485327, lng: -58.843544 });
  });

  it("sin nombre ni direccion queda solo el punto", () => {
    expect(textoDeUbicacion({ latitude: -27.5, longitude: -58.8 })).toBe("📍 Ubicacion compartida: -27.500000,-58.800000");
  });

  it("no confunde un DNI o una altura con coordenadas", () => {
    expect(coordenadasDe("Balboa 2475, DNI 26890060")).toBeNull();
  });

  it("el audio entra transcripto, o avisa que no se pudo", () => {
    expect(textoDeAudio("hay un pozo en mi calle")).toBe('🎤 Audio: "hay un pozo en mi calle"');
    expect(textoDeAudio(null)).toBe("🎤 Audio: (no se pudo transcribir)");
    expect(textoDeAudio("   ")).toBe("🎤 Audio: (no se pudo transcribir)");
  });
});

describe("fotos de WhatsApp", () => {
  it("la foto entra marcada, con su epigrafe si lo trae", () => {
    expect(textoDeFoto(null)).toBe("📷 Foto");
    expect(textoDeFoto("asi esta el pozo")).toBe('📷 Foto: "asi esta el pozo"');
    expect(textoDeFoto("", 3)).toBe("📷 Fotos (3)");
  });
});
