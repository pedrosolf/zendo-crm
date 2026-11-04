import { Megaphone } from "lucide-react";
import type { ManifiestoModulo } from "@/lib/modules/types";

/**
 * Modulo denuncias: el agente registra reclamos ciudadanos en el portal de denuncias del
 * municipio (proyecto denuncias-next, su propio Supabase) con el mismo flujo que el
 * wizard web: descripcion -> clasificacion -> ubicacion -> datos del vecino -> codigo.
 */
const manifiesto: ManifiestoModulo = {
  nombre: "denuncias",
  titulo: "Reclamos municipales",
  descripcion:
    "El agente clasifica, registra y consulta reclamos en el portal de denuncias del municipio; el vecino recibe su codigo de seguimiento.",
  version: "1.0.0",
  nav: [{ etiqueta: "Reclamos", icono: Megaphone, seccion: "Operaciones" }],
  campos: [
    {
      clave: "dni",
      etiqueta: "DNI",
      tipo: "texto",
      enTabla: true,
      ayuda: "Solo numeros, 7 a 9 digitos.",
    },
    {
      clave: "ultimo_reclamo",
      etiqueta: "Ultimo reclamo",
      tipo: "texto",
      enTabla: true,
      ayuda: "Codigo de seguimiento del portal (lo completa el agente).",
    },
  ],
};

export default manifiesto;
