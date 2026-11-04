# Modulo `denuncias`

El agente registra reclamos ciudadanos en el **portal de denuncias del municipio**
(proyecto `denuncias-next`, con su propio Supabase) siguiendo el mismo recorrido que el
wizard web: descripcion -> clasificacion -> ubicacion -> datos del vecino -> codigo de
seguimiento. El reclamo queda en la misma tabla `denuncias`, asi que el personal lo ve en
su panel como cualquier otro.

| Que | Donde |
|---|---|
| Menu | "Reclamos" (Operaciones): ultimos 50 reclamos del portal |
| Tools del agente | `clasificar_reclamo`, `listar_problemas`, `registrar_reclamo`, `consultar_reclamo` |
| Campos de contacto | `dni`, `ultimo_reclamo` (los completa el agente) |
| Tablas | ninguna: los datos viven en el portal |

- **Clasificacion**: `lib/clasificador.ts` es copia del de `denuncias-next`. Mismo texto,
  mismas sugerencias que en la web. Si el portal cambia su algoritmo, copiarlo de nuevo.
  Es por palabras y depende de la tabla `sinonimos` del portal: sin sinonimos, frases
  comunes ("no anda la luz") no dan nada. Por eso `clasificar_reclamo` devuelve tambien los
  tipos y el agente puede elegir uno y ver sus problemas con `listar_problemas`. Cargar
  sinonimos en el portal mejora la web y el bot a la vez.
- **Esquinas**: Nominatim no las entiende; se ubica sobre la primera calle y la esquina
  queda anotada en `referencia` como "punto aproximado".
- **Ubicacion**: por chat no hay mapa. La direccion se geocodifica con Nominatim dentro de
  la ciudad (`DENUNCIAS_CIUDAD`, `DENUNCIAS_CENTRO`). Si no se encuentra, el agente pide una
  esquina o referencia; como ultimo recurso registra con la ubicacion del centro y lo
  aclara en `referencia` ("Ubicacion aproximada").
- **Foto**: el wizard la permite (opcional); por chat todavia no se adjunta.
- **Consulta de estado**: devuelve estado, problema y direccion, nunca datos del vecino.

## Variables de entorno

| Variable | Que es |
|---|---|
| `DENUNCIAS_SUPABASE_URL` | URL del proyecto Supabase del portal |
| `DENUNCIAS_SUPABASE_SERVICE_ROLE_KEY` | Service role del portal (el codigo lo pone un trigger y leerlo es solo del personal) |
| `DENUNCIAS_CIUDAD` | Se agrega a la busqueda de direcciones. Default `Corrientes, Argentina` |
| `DENUNCIAS_CENTRO` | `lat,lng` del centro de la ciudad. Default `-27.4806,-58.8341` |
| `NOMINATIM_EMAIL` | Contacto que pide la politica de uso de Nominatim |

## Activar

1. Agregar `"denuncias"` a los modulos del perfil (Estudio -> Modulos) o a `config/modulos.json`.
2. Reiniciar la app (no tiene migraciones).
