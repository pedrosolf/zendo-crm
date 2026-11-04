"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Documento {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
  estado: "procesando" | "listo" | "error";
  error: string | null;
  fragmentos: number;
  modeloEmbedding: string | null;
  createdAt: string;
}

function tamano(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

/**
 * Base de conocimiento: documentos (catalogos, listas de precios, tramites) que el agente
 * consulta con buscar_conocimiento. Ver specs/nucleo/13-base-de-conocimiento.md.
 */
export function KnowledgeSettings() {
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pedir = useCallback(async () => {
    const r = await fetch("/api/conocimiento", { cache: "no-store" });
    return r.ok ? ((await r.json()) as Documento[]) : [];
  }, []);

  useEffect(() => {
    let vivo = true;
    pedir().then((d) => vivo && setDocs(d)).catch(() => vivo && setDocs([]));
    return () => {
      vivo = false;
    };
  }, [pedir]);

  // Mientras haya alguno procesando, se consulta cada 3 s.
  const procesando = docs?.some((d) => d.estado === "procesando") ?? false;
  useEffect(() => {
    if (!procesando) return;
    const t = setInterval(() => pedir().then(setDocs).catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [procesando, pedir]);

  async function subir(archivo: File) {
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      const r = await fetch("/api/conocimiento", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo subir");
      toast.success(`${archivo.name}: procesando`);
      setDocs(await pedir());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setSubiendo(false);
    }
  }

  async function borrar(doc: Documento) {
    if (!confirm(`Borrar "${doc.nombre}"? El agente deja de usarlo.`)) return;
    const r = await fetch(`/api/conocimiento/${doc.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error("No se pudo borrar");
    toast.success("Documento borrado");
    setDocs(await pedir());
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Subi catalogos, listas de precios, tramites o preguntas frecuentes. Se parten en fragmentos y se vectorizan; el
        agente los consulta con <code className="rounded bg-muted px-1">buscar_conocimiento</code> antes de responder
        datos concretos, en vez de inventarlos.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={subiendo} onClick={() => input.current?.click()} className="cursor-pointer">
          {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir documento
        </Button>
        <span className="text-xs text-muted-foreground">PDF con texto, TXT o MD · max 15 MB</span>
        <input
          ref={input}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) subir(f);
            e.target.value = "";
          }}
        />
      </div>

      {docs === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </p>
      ) : docs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin documentos. El agente responde solo con su prompt.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {tamano(d.tamano)}
                  {d.estado === "listo" && ` · ${d.fragmentos} fragmentos · ${d.modeloEmbedding ?? "sin vectores (busqueda por palabras)"}`}
                  {d.error && ` · ${d.error}`}
                </p>
              </div>
              {d.estado === "procesando" && (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Procesando
                </Badge>
              )}
              {d.estado === "listo" && (
                <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Listo
                </Badge>
              )}
              {d.estado === "error" && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> Error
                </Badge>
              )}
              <Button variant="ghost" size="icon" aria-label="Borrar" onClick={() => borrar(d)} className="cursor-pointer text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
