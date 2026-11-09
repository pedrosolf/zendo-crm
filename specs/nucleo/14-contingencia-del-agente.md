# Spec: Contingencia del agente cuando la IA no responde

**Carril**: ligero (sin tablas ni contratos nuevos; un campo opcional en la config)
**Estado**: implementada
**Fecha**: 2026-11-09
**Escrita antes del codigo**: no (nace de un incidente; se documenta junto al arreglo)

## Problema

El 2026-11-05 el modelo principal de NVIDIA NIM quedo colgado (90 s sin responder). El
agente lo esperaba sin tope, Vercel corto la funcion a los 60 s y el job quedo en
`processing` para siempre. Resultado: el vecino escribia y no recibia nada, y en el CRM
no aparecia ningun error. Lo mismo pasaria con una cuota agotada o una clave vencida.

## Decisiones del dueno

- D1 (2026-11-09) "Si la IA no responde, cambiar el modelo o, de ultima, informar que el
  bot esta fuera de servicio por el momento y que vuelva mas tarde."

## Comportamiento

1. **Cadena de modelos.** Principal (`AGENT_MODEL` -> config -> default del proveedor) y
   despues los respaldos de `AGENT_MODEL_FALLBACK`, en orden, separados por coma. Cada
   entrada puede llevar proveedor: `openrouter:google/gemini-2.5-flash` salta a otro
   proveedor si tiene clave. Sin la variable, el respaldo por defecto del proveedor (con
   NVIDIA, `nvidia/nemotron-3.5-lightning-30b-a3b`; con OpenRouter, ninguno). `off` deja
   solo el principal.
2. **Cualquier error pasa al siguiente** (tiempo agotado, red, 4xx, 5xx, respuesta
   vacia). Una vez que un modelo falla, el resto del turno sigue con el siguiente: no se
   lo vuelve a esperar en cada ronda de tools.
3. **Topes de tiempo.** Cada llamada espera `AGENT_LLM_TIMEOUT_MS` (20 s). El turno
   entero, tools incluidas, tiene `AGENT_BUDGET_MS` (50 s) y reserva 5 s para avisar y
   cerrar el job antes del corte de 60 s de la plataforma.
4. **Aviso.** Si no queda modelo ni tiempo (o se agotan las rondas de tools), el cliente
   recibe `config.agente.mensajeSinServicio` por `deliverMessage`. No se repite si el
   ultimo saliente del hilo ya fue ese aviso hace menos de 30 minutos. El job termina
   `failed` con `llm_no_disponible`, asi queda a la vista.

## Donde vive

- `src/lib/agent/contingencia.ts`: logica pura (cadena, tiempos, cuando avisar).
- `src/lib/agent/openrouter.ts`: un cliente por proveedor, `cadenaDelAgente()`, topes.
- `src/lib/agent/index.ts`: el loop usa la cadena y `sinServicio()`.
- `src/lib/config/schema.ts`: `agente.mensajeSinServicio` (con default); editable en el
  Estudio, paso Agente.
- `tests/agente-contingencia.test.ts`.

## Verificacion (2026-11-09, servidor local contra NVIDIA real)

| Caso | Resultado |
|---|---|
| Principal inexistente, respaldo lightning | responde el respaldo |
| Ningun modelo anda, 3 mensajes seguidos | 1 aviso, los otros 2 no lo repiten |
| Tope de 800 ms (simula modelo colgado) | corta los dos y avisa en ~12 s |
