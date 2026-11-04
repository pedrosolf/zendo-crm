import { conEstudio, leerJson } from "@/lib/estudio/api";
import { crearPerfil, ErrorEstudio, estadoEstudio, importarConfigActual, type OrigenPerfil } from "@/lib/estudio/perfiles";

export const dynamic = "force-dynamic";

/** Estado del Estudio: perfiles, activo, plantillas y modulos disponibles. */
export async function GET() {
  return conEstudio(async () => estadoEstudio());
}

/**
 * Crear un perfil o importar el config/cliente.ts escrito a mano.
 *   { accion: "crear", nombre, slug, desde: { tipo: "vacio" | "plantilla" | "perfil", ... } }
 *   { accion: "importar", slug }
 */
export async function POST(req: Request) {
  return conEstudio(async () => {
    const body = await leerJson(req);
    if (body.accion === "importar") {
      return { slug: await importarConfigActual(body.slug) };
    }
    if (body.accion === "crear") {
      const desde = (body.desde ?? { tipo: "vacio" }) as OrigenPerfil;
      if (!["vacio", "plantilla", "perfil"].includes(desde?.tipo)) {
        throw new ErrorEstudio("Origen invalido.");
      }
      return { slug: crearPerfil({ nombre: String(body.nombre ?? ""), slug: body.slug, desde }) };
    }
    throw new ErrorEstudio("Accion desconocida.");
  });
}
