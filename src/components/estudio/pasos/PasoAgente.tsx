"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Campo, erroresDe } from "../campos-ui";
import type { PropsPaso } from "./tipos";

const ESQUELETO_PROMPT = `Sos {nombre del agente}, del equipo de {negocio}.

Que hace el negocio: {una o dos frases}.

Tu objetivo en cada conversacion:
1. Responder rapido y con calidez.
2. Averiguar {los datos clave}.
3. Cuando el cliente esta listo, {agendar / cotizar / derivar}.

Tono: {cercano, profesional...}. Mensajes cortos, como en WhatsApp.

Nunca: {lo que no puede hacer: dar precios cerrados, diagnosticos, prometer plazos}.`;

export function PasoAgente({ config, cambiar, errores }: PropsPaso) {
  const a = config.agente ?? {};
  const set = (parcial: Partial<NonNullable<typeof config.agente>>) =>
    cambiar((c) => ({ ...c, agente: { ...c.agente, ...parcial } }));

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Campo etiqueta="Nombre del agente" ayuda="Como se presenta en la conversacion." errores={erroresDe(errores, "agente.nombre")}>
        <Input value={a.nombre ?? ""} maxLength={40} placeholder="Asistente" onChange={(e) => set({ nombre: e.target.value })} />
      </Campo>
      <Campo
        etiqueta="Como se llama al rol asesor"
        ayuda="Asesor, Vendedor, Recepcion..."
        errores={erroresDe(errores, "roles")}
      >
        <Input
          value={config.roles?.etiquetaAsesor ?? ""}
          maxLength={30}
          placeholder="Asesor"
          onChange={(e) => cambiar((c) => ({ ...c, roles: { etiquetaAsesor: e.target.value } }))}
        />
      </Campo>

      <Campo
        etiqueta="Prompt base"
        className="sm:col-span-2"
        ayuda={
          <>
            Vacio = el prompt generico del nucleo. El CRM agrega solo el contexto del contacto, la etapa y los datos a averiguar.{" "}
            {!a.prompt && (
              <button type="button" className="cursor-pointer text-primary hover:underline" onClick={() => set({ prompt: ESQUELETO_PROMPT })}>
                Empezar con un esqueleto
              </button>
            )}
          </>
        }
        errores={erroresDe(errores, "agente.prompt")}
      >
        <Textarea
          value={a.prompt ?? ""}
          rows={12}
          className="font-mono text-xs leading-relaxed"
          placeholder="Deja vacio para usar el generico."
          onChange={(e) => set({ prompt: e.target.value || undefined })}
        />
      </Campo>

      <Campo
        etiqueta="Mensaje al derivar a una persona"
        className="sm:col-span-2"
        ayuda="Lo que dice el agente cuando pasa la conversacion al equipo."
        errores={erroresDe(errores, "agente.mensajeDerivacion")}
      >
        <Textarea
          value={a.mensajeDerivacion ?? ""}
          rows={2}
          maxLength={500}
          placeholder="Te paso con una persona del equipo que te va a ayudar con esto. Un momento."
          onChange={(e) => set({ mensajeDerivacion: e.target.value || undefined })}
        />
      </Campo>
    </div>
  );
}
