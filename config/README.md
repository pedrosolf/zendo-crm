# config/ — zona del cliente

Todo lo que distingue a esta instancia vive aqui. El nucleo (`src/`) no se toca.

| Archivo | Que es |
|---|---|
| `cliente.ts` | Carga el perfil activo de `perfiles/` (lo reescribe el Estudio al activar otro). Validado con el esquema de `src/lib/config/schema.ts` al arrancar y en `/api/health`. |
| `perfiles/<slug>/config.json` | Un perfil por cliente: marca, pipeline, campos del contacto, agente y modulos. Se editan en el Estudio (`/estudio`) o a mano. Ver `perfiles/README.md`. |
| `plantillas/` | Plantillas de nicho reutilizables (por ejemplo `inmobiliaria.ts`), catalogadas en `plantillas/index.ts` para que el Estudio las ofrezca al crear un perfil. |
| `modulos.json` | Modulos de `modules/` activos. Lo escribe el Estudio al activar un perfil; lo leen el runner de migraciones y el generador del registro. |

Los assets de marca (logo, icono) van en `public/marca/`. Despues de cambiar el icono,
`npm run pwa:icons` regenera `public/icons/`.

Como se aplica un cambio:

- **Marca**: al reiniciar la app (los colores se inyectan en SSR; el manifest y el
  titulo salen de aqui).
- **Pipeline**: al arrancar, `sincronizarPipeline()` crea o actualiza las etapas por su
  `clave`; nunca borra etapas con operaciones.
- **Campos del contacto**: aparecen en el formulario, la ficha, la tabla (`enTabla`) y
  el panel del chat; el agente los califica si tienen `agente`.
- **Modulos**: `modulos.nucleo` apaga funciones del nucleo; `modulos.activos` enciende
  carpetas de `modules/`.
