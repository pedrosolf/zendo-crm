"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy, Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { textoSobre } from "@/lib/config";
import type { EstadoEstudio, PerfilResumen, ResultadoAplicar } from "@/lib/estudio/tipos";
import { Asistente } from "./Asistente";
import { DialogNuevoPerfil } from "./DialogNuevoPerfil";
import { avisarResultado } from "./avisos";

/** Estudio: perfiles de cliente y el asistente para adaptarlos (specs/nucleo/12-estudio.md). */
export function EstudioApp() {
  const [estado, setEstado] = useState<EstadoEstudio | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<null | { duplicar?: string }>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/estudio", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error ?? "No se pudo abrir el Estudio");
    setEstado(d);
  }, []);
  useEffect(() => {
    let vivo = true;
    fetch("/api/estudio", { cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, d: await r.json() }))
      .then(({ ok, d }) => {
        if (!vivo) return;
        if (ok) setEstado(d);
        else toast.error(d.error ?? "No se pudo abrir el Estudio");
      })
      .catch(() => vivo && toast.error("No se pudo abrir el Estudio"));
    return () => {
      vivo = false;
    };
  }, []);

  async function accion(slug: string, metodo: "activar" | "borrar") {
    if (metodo === "borrar" && !confirm(`Borrar el perfil ${slug}? Se borran config/perfiles/${slug} y public/marca/${slug}.`)) return;
    setOcupado(slug);
    try {
      const r = await fetch(
        metodo === "activar" ? `/api/estudio/perfiles/${slug}/activar` : `/api/estudio/perfiles/${slug}`,
        { method: metodo === "activar" ? "POST" : "DELETE" }
      );
      const d = await r.json();
      if (!r.ok) throw new Error([d.error, ...(d.errores ?? [])].join(" "));
      if (metodo === "activar") avisarResultado(d.aplicado as ResultadoAplicar, "Perfil activado", true);
      else toast.success("Perfil borrado");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setOcupado(null);
    }
  }

  async function importar() {
    const slug = prompt("Identificador para el perfil (minusculas y guiones):", "cliente-actual");
    if (!slug) return;
    const r = await fetch("/api/estudio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "importar", slug }),
    });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error ?? "No se pudo importar");
    toast.success("Configuracion importada como perfil");
    await cargar();
  }

  if (!estado) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Abriendo el Estudio...
      </div>
    );
  }

  if (editando) {
    return (
      <Asistente
        slug={editando}
        modulos={estado.modulos}
        onVolver={() => {
          setEditando(null);
          cargar();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estudio"
        subtitle="Adapta el CRM a cada cliente: un perfil por cliente, con guia paso a paso"
        actions={
          <Button onClick={() => setNuevo({})} className="cursor-pointer">
            <Plus className="h-4 w-4" /> Nuevo perfil
          </Button>
        }
      />

      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["Crea un perfil", "Desde cero, desde una plantilla de nicho o duplicando otro cliente."],
          ["Adaptalo con la guia", "Negocio, marca, pipeline, campos, agente y modulos. Cada paso explica que decidir."],
          ["Activalo y proba", "El CRM pasa a ese cliente al instante. Proba en el Simulador y despues commit + deploy."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3 rounded-xl border p-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
            <span>
              <span className="block text-sm font-medium">{t}</span>
              <span className="block text-xs text-muted-foreground">{d}</span>
            </span>
          </li>
        ))}
      </ol>

      {estado.clienteManual && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="flex-1">config/cliente.ts esta escrito a mano y no carga ningun perfil. Importalo para editarlo desde aca.</span>
          <Button size="sm" variant="outline" onClick={importar} className="cursor-pointer">Importar como perfil</Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {estado.perfiles.map((p) => (
          <TarjetaPerfil
            key={p.slug}
            perfil={p}
            ocupado={ocupado === p.slug}
            onEditar={() => setEditando(p.slug)}
            onActivar={() => accion(p.slug, "activar")}
            onDuplicar={() => setNuevo({ duplicar: p.slug })}
            onBorrar={() => accion(p.slug, "borrar")}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        El Estudio solo existe en tu maquina (npm run dev / npm run local): escribe en config/perfiles/ y public/marca/. Todos los perfiles comparten la misma base de datos.
      </p>

      {nuevo && (
        <DialogNuevoPerfil
          abierto
          onCerrar={() => setNuevo(null)}
          onCreado={(slug) => {
            setNuevo(null);
            setEditando(slug);
          }}
          plantillas={estado.plantillas}
          perfiles={estado.perfiles}
          origenInicial={nuevo.duplicar ? { tipo: "perfil", slug: nuevo.duplicar } : undefined}
        />
      )}
    </div>
  );
}

function TarjetaPerfil({
  perfil: p,
  ocupado,
  onEditar,
  onActivar,
  onDuplicar,
  onBorrar,
}: {
  perfil: PerfilResumen;
  ocupado: boolean;
  onEditar: () => void;
  onActivar: () => void;
  onDuplicar: () => void;
  onBorrar: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: p.colorSidebar, color: textoSobre(p.colorSidebar) }}>
        {p.icono && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.icono} alt="" className="h-8 w-8 rounded-full bg-white/10 object-cover" />
        )}
        <span className="min-w-0 flex-1 truncate font-semibold">{p.nombre}</span>
        <span className="h-4 w-4 rounded-full border border-white/30" style={{ background: p.colorPrimario }} title="Color primario" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xs text-muted-foreground">{p.slug}</code>
          {p.activo && <Badge>Activo</Badge>}
          {p.errores.length > 0 && <Badge variant="destructive">{p.errores.length} errores</Badge>}
        </div>
        {p.descripcion && <p className="line-clamp-2 text-xs text-muted-foreground">{p.descripcion}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onEditar} className="cursor-pointer">
            <Pencil className="h-3.5 w-3.5" /> Adaptar
          </Button>
          {!p.activo && (
            <Button size="sm" variant="outline" disabled={ocupado || p.errores.length > 0} onClick={onActivar} className="cursor-pointer">
              {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />} Activar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDuplicar} aria-label="Duplicar" className="cursor-pointer">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {!p.activo && (
            <Button size="sm" variant="ghost" onClick={onBorrar} aria-label="Borrar" className="cursor-pointer text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
