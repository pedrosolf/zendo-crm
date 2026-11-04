# config/perfiles/ — un perfil por cliente

Cada carpeta es un cliente: `config/perfiles/<slug>/config.json` con la configuracion
completa (mismo esquema que `src/lib/config/schema.ts`). Sus logo e icono viven en
`public/marca/<slug>/`.

`config/cliente.ts` importa el perfil **activo**. Lo reescribe el Estudio al activar otro
perfil; no se edita a mano (si se edita, el Estudio lo detecta y ofrece importarlo).

## Como se usa

- **Estudio** (`/estudio`, solo con `npm run dev` o `npm run local`, solo admin): crear,
  adaptar con el asistente guiado, activar, duplicar y borrar perfiles.
- **A mano o con Claude**: editar `config.json` del perfil. Si es el activo, el cambio se
  ve al instante en dev; el pipeline se sincroniza al reiniciar o al guardar desde el
  Estudio.

## Que pasa al activar

1. `config/modulos.json` toma los modulos del perfil y se regenera el registro.
2. El pipeline de la base se sincroniza: se crean las etapas del perfil y se borran las
   del anterior que vinieron de una config y estan vacias. Las que tienen operaciones o se
   crearon a mano en la UI se conservan.
3. Se regeneran los iconos de la PWA desde el icono del perfil.
4. Se reescribe `config/cliente.ts`.

Si cambiaron los modulos: `npm run db:migrar` y reiniciar el servidor.

Todos los perfiles comparten la base de datos de la instancia. Para entregar un cliente:
activar su perfil, commit de `config/` y `public/`, y deploy.

Spec: `specs/nucleo/12-estudio.md`.
