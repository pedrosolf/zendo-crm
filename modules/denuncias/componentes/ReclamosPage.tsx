import "server-only";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { zonaHoraria } from "@/lib/config";
import { portalConfigurado, ultimasDenuncias } from "../lib/portal";

const ESTILO: Record<string, string> = {
  recibido: "bg-sky-50 text-sky-700 border-sky-200",
  en_curso: "bg-amber-50 text-amber-700 border-amber-200",
  finalizado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pospuesto: "bg-slate-50 text-slate-700 border-slate-200",
  rechazado: "bg-rose-50 text-rose-700 border-rose-200",
};

/** Ultimos reclamos del portal de denuncias (los cargados por la web y por el agente). */
export async function ReclamosPage() {
  if (!portalConfigurado()) {
    return (
      <div>
        <PageHeader title="Reclamos" subtitle="Portal de denuncias del municipio" />
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          El portal no esta conectado. Configura DENUNCIAS_SUPABASE_URL y DENUNCIAS_SUPABASE_SERVICE_ROLE_KEY (ver
          modules/denuncias/README.md).
        </p>
      </div>
    );
  }

  let filas: Awaited<ReturnType<typeof ultimasDenuncias>> = [];
  let error: string | null = null;
  try {
    filas = await ultimasDenuncias(50);
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudo leer el portal";
  }
  const fecha = new Intl.DateTimeFormat("es", { timeZone: zonaHoraria(), dateStyle: "short", timeStyle: "short" });

  return (
    <div>
      <PageHeader
        title="Reclamos"
        subtitle="Ultimos reclamos del portal de denuncias: los cargados por la web y por el agente"
        stats={[{ label: "Mostrando", value: filas.length }]}
      />
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {filas.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-sm text-muted-foreground">
          <Megaphone className="h-6 w-6" /> Todavia no hay reclamos.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Codigo</th>
                <th className="px-4 py-2.5 font-medium">Problema</th>
                <th className="px-4 py-2.5 font-medium">Direccion</th>
                <th className="px-4 py-2.5 font-medium">Vecino</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.codigo} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{f.codigo}</td>
                  <td className="px-4 py-2.5">{f.problemas?.nombre}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{f.direccion}</td>
                  <td className="px-4 py-2.5">{f.denunciante_nombre} {f.denunciante_apellido}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={ESTILO[f.estado]}>{f.estado.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{fecha.format(new Date(f.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
