---
name: crear-plugin-estatico-dsh
description: |
  Usar cuando se quiera crear un nuevo plugin, capacidad o extensión para
  DeepSeek Harness. Fija la regla de crear plugins ESTÁTICOS (paquetes en
  packages/) por defecto y reserva el plugin dinámico (cordis_define) solo para
  prototipos efímeros de runtime. Da el flujo de creación y enlaza la guía
  canónica docs/cookbook/adding-a-package.md. Triggers: "crear un plugin",
  "nuevo plugin", "plugin estático", "agregar una capacidad al harness".
---

# Crear un plugin estático de DeepSeek Harness

## Regla de decisión — leer primero

Por defecto, **todo plugin nuevo se crea como paquete estático** en `packages/`.

| Caso | Forma correcta |
|---|---|
| Funcionalidad que debe persistir, sobrevivir reinicios y viajar en el fork | **Estático** (paquete en `packages/`, commiteado) |
| Prototipo rápido desechable de una sesión, probar una idea sin tocar el repo | **Dinámico** (`cordis_define`, runtime) — y descartarlo al terminar |

Un plugin dinámico vive solo en memoria del proceso: se pierde al reiniciar y **no queda en el repo**. Para que un plugin quede en el fork y sea portable, tiene que ser un paquete estático commiteado.

## Flujo de creación

La guía canónica, archivo por archivo, es [adding-a-package.md](../../../docs/cookbook/adding-a-package.md). Resumen del orden:

1. Leer [architecture.md](../../../docs/architecture.md) antes de tocar `packages/` (mapa del sistema y puntos de extensión).
2. Elegir **grupo** existente y **rol** que describa lo que hace hoy (tabla "Name the role that exists" en adding-a-package.md).
3. Crear el esqueleto del paquete: `package.json`, `tsconfig.json`, `src/index.ts`, `src/invariant.ts`, `README.md`.
4. Registrar el paquete en **un solo agregado**: `tsconfig.host.json` o `tsconfig.client.json`.
   - Un plugin de cliente además declara `dsh.client` en su `package.json`, su fila en `packages/bundle/web-app/cordis.patch.yml` y la dependencia en `packages/bundle/web-app/package.json`.
5. Build y verificación: `pnpm install`, `pnpm run constraints && pnpm run typecheck && pnpm run lint`, `pnpm run build`.

## Fuentes de verdad de autoría

- [packages/AGENTS.md](../../../packages/AGENTS.md) — convenciones de paquete (exports, `inject` vs `ctx.get`, `./invariant`, tests, README).
- [packages/client/AGENTS.md](../../../packages/client/AGENTS.md) — checklist completo de paquete cliente (slot system, `dsh.client`, registros en slots).
- [extension-cookbook.md](../../../docs/cookbook/extension-cookbook.md) — mapa feature → mecanismo de extensión.

## Ejemplo trabajado en este fork

El dictado por voz es el plugin estático de referencia:

- Host: `packages/host/voice-dictation` (Remote `voiceTranscribe`).
- Cliente: `packages/client/ui-voice-dictation` (botón de micrófono en el slot `conversation.input.left`).
