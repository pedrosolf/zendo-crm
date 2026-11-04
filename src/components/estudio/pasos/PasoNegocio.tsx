"use client";

import { Input } from "@/components/ui/input";
import { Campo, Opciones, erroresDe } from "../campos-ui";
import type { PropsPaso } from "./tipos";

const MONEDAS = ["USD", "ARS", "CLP", "MXN", "COP", "PEN", "UYU", "BRL", "EUR"];

const ZONAS = [
  "America/Argentina/Buenos_Aires",
  "America/Santiago",
  "America/Montevideo",
  "America/Sao_Paulo",
  "America/Asuncion",
  "America/La_Paz",
  "America/Lima",
  "America/Bogota",
  "America/Caracas",
  "America/Mexico_City",
  "America/New_York",
  "Europe/Madrid",
  "UTC",
];

export function PasoNegocio({ config, cambiar, errores }: PropsPaso) {
  const moneda = config.moneda ?? "USD";
  const zona = config.zonaHoraria ?? "UTC";
  const ahora = (() => {
    try {
      return new Intl.DateTimeFormat("es", { timeZone: zona, dateStyle: "full", timeStyle: "short" }).format(new Date());
    } catch {
      return null;
    }
  })();

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Campo etiqueta="Moneda" ayuda="Codigo ISO de 3 letras. Formatea todos los montos." errores={erroresDe(errores, "moneda")}>
        <div className="flex gap-2">
          <Opciones
            valor={MONEDAS.includes(moneda) ? moneda : "otra"}
            opciones={[...MONEDAS.map((m) => ({ valor: m, etiqueta: m })), { valor: "otra", etiqueta: "Otra..." }]}
            onChange={(v) => cambiar((c) => ({ ...c, moneda: v === "otra" ? "" : v }))}
            className="w-32"
          />
          {!MONEDAS.includes(moneda) && (
            <Input
              value={moneda}
              maxLength={3}
              placeholder="GTQ"
              onChange={(e) => cambiar((c) => ({ ...c, moneda: e.target.value.toUpperCase() }))}
              className="w-24 font-mono"
            />
          )}
        </div>
      </Campo>

      <Campo etiqueta="Idioma" errores={erroresDe(errores, "idioma")}>
        <Opciones
          valor={config.idioma ?? "es"}
          opciones={[
            { valor: "es", etiqueta: "Espanol" },
            { valor: "en", etiqueta: "English" },
          ]}
          onChange={(v) => cambiar((c) => ({ ...c, idioma: v as "es" | "en" }))}
        />
      </Campo>

      <Campo
        etiqueta="Zona horaria del negocio"
        className="sm:col-span-2"
        ayuda={ahora ? `Ahora en esa zona: ${ahora}` : "Identificador IANA, por ejemplo America/Santiago."}
        errores={erroresDe(errores, "zonaHoraria")}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Opciones
            valor={ZONAS.includes(zona) ? zona : "otra"}
            opciones={[...ZONAS.map((z) => ({ valor: z, etiqueta: z })), { valor: "otra", etiqueta: "Otra..." }]}
            onChange={(v) => cambiar((c) => ({ ...c, zonaHoraria: v === "otra" ? "" : v }))}
            className="sm:w-80"
          />
          {!ZONAS.includes(zona) && (
            <Input
              value={zona}
              placeholder="America/Guatemala"
              onChange={(e) => cambiar((c) => ({ ...c, zonaHoraria: e.target.value.trim() }))}
              className="font-mono text-xs"
            />
          )}
        </div>
      </Campo>
    </div>
  );
}
