"use client";

import { Puzzle } from "lucide-react";
import type { ModuloDisponible } from "@/lib/estudio/tipos";
import { Interruptor, erroresDe } from "../campos-ui";
import type { PropsPaso } from "./tipos";

const NUCLEO = [
  { clave: "automatizaciones", titulo: "Automatizaciones", descripcion: "Reglas que mueven etapas, asignan o avisan solas." },
  { clave: "actividades", titulo: "Actividades", descripcion: "Tareas y seguimientos del equipo." },
  { clave: "plantillas", titulo: "Plantillas de WhatsApp", descripcion: "Mensajes aprobados para escribir fuera de la ventana de 24 h." },
  { clave: "push", titulo: "Notificaciones push", descripcion: "Avisos en el celular cuando entra un mensaje o se deriva." },
  { clave: "reportes", titulo: "Reportes", descripcion: "Embudo, conversion y rendimiento del agente." },
  { clave: "simulador", titulo: "Simulador", descripcion: "Probar el agente sin WhatsApp (solo admin)." },
] as const;

type ClaveNucleo = (typeof NUCLEO)[number]["clave"];

export function PasoModulos({ config, cambiar, errores, disponibles }: PropsPaso & { disponibles: ModuloDisponible[] }) {
  const nucleo = config.modulos?.nucleo ?? {};
  const activos = config.modulos?.activos ?? [];

  const setNucleo = (clave: ClaveNucleo, v: boolean) =>
    cambiar((c) => ({
      ...c,
      modulos: { ...c.modulos, nucleo: { ...c.modulos?.nucleo, [clave]: v } },
    }));
  const setModulo = (nombre: string, v: boolean) =>
    cambiar((c) => {
      const lista = c.modulos?.activos ?? [];
      return {
        ...c,
        modulos: { ...c.modulos, activos: v ? [...lista.filter((m) => m !== nombre), nombre] : lista.filter((m) => m !== nombre) },
      };
    });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Funciones del nucleo</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {NUCLEO.map((n) => (
            <Interruptor
              key={n.clave}
              activo={nucleo[n.clave] !== false}
              onChange={(v) => setNucleo(n.clave, v)}
              etiqueta={n.titulo}
              descripcion={n.descripcion}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Puzzle className="h-4 w-4" /> Modulos de modules/
        </h3>
        {disponibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay modulos en modules/. Se crean con la skill crear-modulo.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {disponibles.map((m) => (
              <Interruptor
                key={m.nombre}
                activo={activos.includes(m.nombre)}
                onChange={(v) => setModulo(m.nombre, v)}
                etiqueta={m.titulo}
                descripcion={m.descripcion || m.nombre}
              />
            ))}
          </div>
        )}
        {erroresDe(errores, "modulos").map((e) => (
          <p key={e} className="text-xs text-destructive">{e}</p>
        ))}
      </section>
    </div>
  );
}
