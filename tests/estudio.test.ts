import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claveDesdeTexto,
  esPng,
  generarClienteTs,
  perfilActivoDesde,
  slugDesdeNombre,
  slugValido,
} from "@/lib/estudio/archivos";
import {
  activarPerfil,
  borrarPerfil,
  crearPerfil,
  ErrorEstudio,
  guardarAsset,
  guardarPerfil,
  leerPerfil,
} from "@/lib/estudio/perfiles";

/**
 * El Estudio escribe archivos del repo desde una pagina web. Lo que no puede fallar en
 * silencio: escribir fuera de config/perfiles/ y public/marca/ (un slug con ../), dejar
 * una config invalida en disco (la instancia no arrancaria) y aceptar cualquier archivo
 * como logo. Ver specs/nucleo/12-estudio.md.
 */

describe("slugs y claves", () => {
  it("acepta identificadores simples y rechaza rutas", () => {
    expect(slugValido("clinica-norte")).toBe(true);
    expect(slugValido("casa2")).toBe(true);
    for (const malo of ["../x", "a/b", "Clinica", "", "-x", "x-", "a".repeat(41), "a.b", "a\\b", null]) {
      expect(slugValido(malo)).toBe(false);
    }
  });

  it("deriva slug y clave desde texto con acentos", () => {
    expect(slugDesdeNombre("Clínica Dental Ñuñoa")).toBe("clinica-dental-nunoa");
    expect(slugDesdeNombre("!!!")).toBe("");
    expect(claveDesdeTexto("Visita agendada")).toBe("visita_agendada");
    expect(claveDesdeTexto("2da visita")).toBe("c_2da_visita");
  });
});

describe("config/cliente.ts generado", () => {
  it("el perfil activo se lee de vuelta del archivo generado", () => {
    expect(perfilActivoDesde(generarClienteTs("casa-sur"))).toBe("casa-sur");
  });

  it("un cliente.ts escrito a mano no tiene perfil activo", () => {
    expect(perfilActivoDesde('export default definirConfig({ marca: {} });')).toBeNull();
  });

  it("no genera un import con un slug invalido", () => {
    expect(() => generarClienteTs("../../etc")).toThrow();
  });
});

describe("validacion de PNG", () => {
  it("reconoce la firma y rechaza lo demas", () => {
    expect(esPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(true);
    expect(esPng(new TextEncoder().encode("<svg onload=alert(1)>"))).toBe(false);
    expect(esPng(new Uint8Array([0x89, 0x50]))).toBe(false);
  });
});

describe("perfiles en disco", () => {
  const cwd = process.cwd();
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "estudio-"));
    mkdirSync(join(dir, "config", "perfiles"), { recursive: true });
    mkdirSync(join(dir, "public", "marca"), { recursive: true });
    // Los modulos que activa la plantilla inmobiliaria tienen que existir en modules/.
    for (const m of ["propiedades", "visitas"]) {
      mkdirSync(join(dir, "modules", m), { recursive: true });
      writeFileSync(join(dir, "modules", m, "manifiesto.ts"), `export default { titulo: "${m}" };\n`);
      writeFileSync(join(dir, "modules", m, "servidor.ts"), "export default {};\n");
    }
    writeFileSync(join(dir, "config", "modulos.json"), '{ "activos": [] }\n');
    writeFileSync(join(dir, "config", "cliente.ts"), "// escrito a mano\n");
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  });

  const archivo = (slug: string) => join(dir, "config", "perfiles", slug, "config.json");

  it("crea un perfil desde la plantilla con la marca y los assets del perfil", () => {
    crearPerfil({ nombre: "Casa Sur Propiedades", slug: "casa-sur", desde: { tipo: "plantilla", clave: "inmobiliaria" } });
    const c = leerPerfil("casa-sur");
    expect(c.marca.nombre).toBe("Casa Sur Propiedades");
    expect(c.marca.nombreCorto.length).toBeLessThanOrEqual(12);
    expect(c.marca.logo).toBe("/marca/casa-sur/logo.png");
    expect(c.pipeline.etapas.some((e) => e.clave === "visita_agendada")).toBe(true);
  });

  it("no crea con un slug que se sale de la carpeta", () => {
    expect(() => crearPerfil({ nombre: "X", slug: "../../config", desde: { tipo: "vacio" } })).toThrow(ErrorEstudio);
    expect(existsSync(join(dir, "config", "config.json"))).toBe(false);
  });

  it("una config invalida no se escribe", async () => {
    crearPerfil({ nombre: "Norte", slug: "norte", desde: { tipo: "vacio" } });
    const antes = readFileSync(archivo("norte"), "utf8");
    const mala = { ...leerPerfil("norte"), marca: { nombre: "Norte", nombreCorto: "Norte", colorPrimario: "rojo" } };
    await expect(guardarPerfil("norte", mala)).rejects.toMatchObject({ errores: [expect.stringContaining("marca.colorPrimario")] });
    expect(readFileSync(archivo("norte"), "utf8")).toBe(antes);
  });

  it("rechaza modulos que no existen en modules/", async () => {
    crearPerfil({ nombre: "Norte", slug: "norte", desde: { tipo: "vacio" } });
    const c = { ...leerPerfil("norte"), modulos: { activos: ["no_existe"] } };
    await expect(guardarPerfil("norte", c)).rejects.toBeInstanceOf(ErrorEstudio);
  });

  it("activar reescribe cliente.ts y no deja borrar el activo", async () => {
    crearPerfil({ nombre: "Norte", slug: "norte", desde: { tipo: "vacio" } });
    await activarPerfil("norte");
    expect(perfilActivoDesde(readFileSync(join(dir, "config", "cliente.ts"), "utf8"))).toBe("norte");
    expect(() => borrarPerfil("norte")).toThrow(ErrorEstudio);
  });

  it("solo acepta PNG como logo", async () => {
    crearPerfil({ nombre: "Norte", slug: "norte", desde: { tipo: "vacio" } });
    await expect(guardarAsset("norte", "logo", new TextEncoder().encode("<svg/>"))).rejects.toBeInstanceOf(ErrorEstudio);
    await expect(guardarAsset("norte", "../../x", new Uint8Array(16))).rejects.toBeInstanceOf(ErrorEstudio);
  });
});
