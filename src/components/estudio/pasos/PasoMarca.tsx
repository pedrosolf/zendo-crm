"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { textoSobre } from "@/lib/config";
import type { AssetMarca } from "@/lib/estudio/archivos";
import { Campo, EntradaColor, erroresDe } from "../campos-ui";
import type { PropsPaso } from "./tipos";

const hexOk = (v: string | undefined, def: string) => (v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def);

export function PasoMarca({ config, cambiar, errores, slug }: PropsPaso & { slug: string }) {
  const m = config.marca;
  const [version, setVersion] = useState(() => Date.now());
  const set = (campo: keyof typeof m, valor: string) =>
    cambiar((c) => ({ ...c, marca: { ...c.marca, [campo]: valor } }));

  const primario = hexOk(m.colorPrimario, "#2E4A47");
  const sidebar = hexOk(m.colorSidebar, "#0F1419");

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo etiqueta="Nombre" ayuda={`${m.nombre?.length ?? 0}/60`} errores={erroresDe(errores, "marca.nombre")}>
          <Input value={m.nombre ?? ""} maxLength={60} onChange={(e) => set("nombre", e.target.value)} />
        </Campo>
        <Campo
          etiqueta="Nombre corto"
          ayuda={`${m.nombreCorto?.length ?? 0}/12 · icono del celular y notificaciones`}
          errores={erroresDe(errores, "marca.nombreCorto")}
        >
          <Input value={m.nombreCorto ?? ""} maxLength={12} onChange={(e) => set("nombreCorto", e.target.value)} />
        </Campo>
        <Campo
          etiqueta="Descripcion"
          className="sm:col-span-2"
          ayuda="Una frase. Aparece en el login."
          errores={erroresDe(errores, "marca.descripcion")}
        >
          <Textarea
            value={m.descripcion ?? ""}
            maxLength={200}
            rows={2}
            onChange={(e) => set("descripcion", e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Color primario" ayuda="Botones y acciones." errores={erroresDe(errores, "marca.colorPrimario")}>
          <EntradaColor valor={m.colorPrimario ?? ""} onChange={(v) => set("colorPrimario", v)} />
        </Campo>
        <Campo etiqueta="Color del sidebar" ayuda="Barra lateral y barra del celular." errores={erroresDe(errores, "marca.colorSidebar")}>
          <EntradaColor valor={m.colorSidebar ?? ""} onChange={(v) => set("colorSidebar", v)} />
        </Campo>
        <SubirAsset slug={slug} asset="logo" etiqueta="Logo" ruta={m.logo} version={version} onSubido={(r) => { set("logo", r); setVersion(Date.now()); }} />
        <SubirAsset slug={slug} asset="icono" etiqueta="Icono" ruta={m.icono} version={version} onSubido={(r) => { set("icono", r); setVersion(Date.now()); }} />
      </div>

      {/* Vista previa: como se ve el sidebar, un boton y el login con esta marca. */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Vista previa</p>
        <div className="overflow-hidden rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 px-3 py-3" style={{ background: sidebar, color: textoSobre(sidebar) }}>
            {m.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${m.logo}?v=${version}`} alt="" className="h-7 w-7 rounded-full object-cover" />
            )}
            <span className="truncate text-sm font-semibold">{m.nombre || "Nombre"}</span>
          </div>
          <div className="space-y-1 px-3 py-2 text-xs" style={{ background: sidebar, color: textoSobre(sidebar) }}>
            <div className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.08)", borderLeft: `3px solid ${primario}` }}>
              Pipeline
            </div>
            <div className="px-2 py-1 opacity-70">Contactos</div>
          </div>
          <div className="space-y-3 bg-background p-4">
            <p className="text-xs text-muted-foreground">{m.descripcion || "Descripcion del CRM"}</p>
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-sm font-medium"
              style={{ background: primario, color: textoSobre(primario) }}
            >
              Iniciar sesion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubirAsset({
  slug,
  asset,
  etiqueta,
  ruta,
  version,
  onSubido,
}: {
  slug: string;
  asset: AssetMarca;
  etiqueta: string;
  ruta?: string;
  version: number;
  onSubido: (ruta: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(archivo: File) {
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      const r = await fetch(`/api/estudio/perfiles/${slug}/marca/${asset}`, { method: "POST", body: form });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error ?? "No se pudo subir");
      onSubido(String(datos.ruta).split("?")[0]);
      toast.success(`${etiqueta} actualizado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <Campo etiqueta={etiqueta} ayuda="PNG cuadrado, max 2 MB.">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          {ruta && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${ruta}?v=${version}`} alt={etiqueta} className="h-full w-full object-contain" />
          )}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => input.current?.click()} className="cursor-pointer">
          <Upload className="h-3.5 w-3.5" /> {subiendo ? "Subiendo..." : "Subir PNG"}
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) subir(f);
            e.target.value = "";
          }}
        />
      </div>
    </Campo>
  );
}
