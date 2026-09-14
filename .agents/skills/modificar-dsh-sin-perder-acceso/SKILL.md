---
name: modificar-dsh-sin-perder-acceso
description: |
  Usar SIEMPRE que se vaya a modificar el propio entorno DSH (código del
  harness, bundles del cliente, config del host, plugins, skills) mientras el
  agente corre dentro del Web GUI. El agente vive DENTRO del proceso del GUI,
  así que ciertas operaciones matan su propia sesión: define qué es seguro desde
  el agente, qué exige terminal externa, el checkpoint y handoff obligatorios, y
  cómo verificar y levantar el server automáticamente si el acceso se pierde.
  Triggers: "modificar dsh", "cambiar el harness", "rebuild del cliente",
  "se cayó dsh", "perdí el acceso al gui", "actualizar el fork".
---

# Modificar DSH sin perder el acceso

Protocolo para tocar el entorno DSH en el que el agente vive. **El invariante:** el agente DSH corre **dentro** del proceso del Web GUI (`com.nanoctrl.dsh`, puerto 3080, `KeepAlive=true` vía wrapper). Cualquier operación que mate o reinicie ese proceso **mata la sesión del agente a mitad de camino**. El proceso vuelve solo; **el hilo de trabajo no**.

## Qué se pierde y qué no (medido, no supuesto)

| | Sobrevive a la caída | Se pierde |
|---|---|---|
| Proceso del GUI | ✅ KeepAlive + wrapper con backoff (1s→60s) lo relanzan | — |
| Sesiones | ✅ JSONL en `~/.dsh/sessions/` | — |
| **Turno del agente** | — | ❌ muere a mitad de la operación |
| **Hilo de la conversación** | — | ❌ el usuario queda sin agente y sin saber qué seguía |

**Modo de fallo real:** tras **10 crashes consecutivos** el wrapper hace `bootout` del agente *a propósito* (para no loopear). Ahí el server **no vuelve solo** hasta un `bootstrap` manual. Un rebuild desde el agente puede dispararlo.

## Clasificación de operaciones

### 🟢 Verde — seguro desde el agente

No reescriben artefactos que el GUI sirva ni reinician el proceso:

- Editar fuentes (`src/**`, tests, docs, skills, config no observada).
- `git` (fetch, merge, commit, push, resolver conflictos).
- `pnpm install` (dependencias; no toca bundles servidos).
- `pnpm run typecheck`, `pnpm test`, `pnpm run test:gui`.
- Leer logs, `launchctl print`, `curl` al puerto.

### 🟡 Amarilla — reinicio controlado (avisar antes)

El agente muere, pero de forma previsible y el server vuelve:

- Cambios de **config del host** (`~/.dsh/settings.yaml`, presets).
- Agregar/quitar un **plugin host**.
- Skills nuevos o editados (el watcher los recarga; normalmente no reinicia).

Avisar al usuario **en el mismo mensaje** antes de ejecutarlas, con el comando de verificación a mano.

### 🔴 Roja — mata la sesión desde el agente

Reescriben los bundles que el proceso sirve y observa por HMR:

- `pnpm run build` (completo)
- `pnpm run build:lib:client` · `pnpm run build:web`
- `pnpm run build:lib:host` · `pnpm run build:lib` (cara host)
- `launchctl kickstart/bootout` … ejecutado **desde** el agente
- `pnpm run dev:web` (levanta un watcher de Vite sobre los bundles)

**Ninguna de estas las corre el agente.** Las corre el **usuario desde una terminal externa** (Terminal.app, iTerm) o por CLI (`claude`, `codex`).

## Protocolo

### Fase 1 — Checkpoint (agente, obligatorio antes de una operación 🔴)

El repo debe quedar en un estado del que se pueda retomar sin la conversación:

```sh
git status --porcelain          # debe estar limpio, o commitear lo que haya
git push dsh-nanoctrl-fork master   # lo importante NO puede vivir solo en el working tree
```

Regla dura: **si la sesión muere con trabajo sin commitear, ese trabajo se pierde** (o queda a medio entender). Commitear o stashear antes.

### Fase 2 — Handoff (agente, obligatorio)

Escribir un relevo explícito para que la próxima sesión (o el propio usuario) retome sin adivinar. En el mensaje al usuario y, si el trabajo es largo, en un archivo:

- **Qué se estaba haciendo** y por qué (una línea).
- **Qué quedó hecho** (commits, archivos).
- **Qué falta exactamente** (próximo paso concreto).
- **El comando exacto** que debe correr el usuario, copiable tal cual.
- **Cómo verificar** que salió bien.

### Fase 3 — Ejecución externa (usuario, terminal externa)

El usuario corre el build rojo y, después:

```sh
~/.dsh/dsh-health.sh        # verifica que el GUI responde y lo levanta si no
```

Luego refresh forzado del navegador (**Cmd+Shift+R**) para no servir bundles cacheados.

### Fase 4 — Reanudar

Sesión nueva (o la misma) + el handoff de la Fase 2. La sesión vieja está persistida en `~/.dsh/sessions/`.

## Recuperación automática si el acceso se pierde

`~/.dsh/dsh-health.sh` es idempotente y **seguro desde cualquier lado**: no reconstruye artefactos, solo verifica y levanta. Cubre los dos casos:

1. **Agente cargado pero caído/colgado** → `launchctl kickstart -kp`.
2. **Agente desactivado** (bootout tras crash-loop) → `launchctl bootstrap`.

Uso:

```sh
~/.dsh/dsh-health.sh          # 8 intentos, 2s entre cada uno
~/.dsh/dsh-health.sh 15 3     # más paciente
```

Salida: `0` = GUI arriba (o levantado), `1` = no se pudo (mirar el log).

### Las tres capas — qué es automático hoy

| Capa | Cubre | ¿Automático? |
|---|---|---|
| `KeepAlive` + wrapper | proceso muerto o colgado → relanza con backoff 1s→60s | ✅ ya activo |
| `~/.dsh/dsh-health.sh` | incluye el caso **bootout**, que KeepAlive **no** cubre | ⚠️ a demanda |
| Watchdog (LaunchAgent aparte) | corre `dsh-health.sh` cada N segundos | ❌ no instalado |

El wrapper **no** cubre el bootout deliberado tras 10 crashes: ahí launchd ya no tiene el agente cargado y **nada lo relanza solo**. Ése es exactamente el hueco que tapa `dsh-health.sh`, y el motivo de correrlo después de un build rojo.

Para cobertura sin intervención, un watchdog es un LaunchAgent separado (mismo `dsh-health.sh`, sin lógica nueva):

```xml
<!-- ~/Library/LaunchAgents/com.nanoctrl.dsh-watchdog.plist (resumen) -->
<key>Label</key><string>com.nanoctrl.dsh-watchdog</string>
<key>ProgramArguments</key>
<array><string>/bin/bash</string><string>/Users/<usuario>/.dsh/dsh-health.sh</string><string>2</string><string>5</string></array>
<key>StartInterval</key><integer>60</integer>
<key>RunAtLoad</key><true/>
```

Trade-off: un watchdog revive el agente cada minuto aunque el crash sea determinístico (config rota). No es un loop apretado, pero mantiene el proceso intentando. Instalarlo solo si preferís "siempre arriba" por sobre "fallar callado".

## Diagnóstico de una caída

```sh
launchctl print gui/$(id -u)/com.nanoctrl.dsh | grep -E 'state|pid|runs|last exit'
cat /tmp/dsh-crash-count                 # crashes consecutivos (se resetea a los 30s sin crash)
tail -40 /tmp/com.nanoctrl.dsh.log       # log unificado del wrapper
lsof -tiTCP:3080 -sTCP:LISTEN            # quién escucha el puerto
```

Señales:
- `state = running` + `last exit code = 0` → el server está sano.
- `crash-count` acercándose a **10** → riesgo de bootout automático: **parar** de disparar crashes.
- Agente ausente de `launchctl print` → se booteó solo: usar el caso 2 de `dsh-health.sh`.

## Anti-patrones

- ❌ Correr `pnpm run build` "para verificar" desde el agente. Es el error que se auto-sabotea.
- ❌ Asumir que si el proceso vuelve, la conversación sigue. No sigue: el turno murió.
- ❌ Dejar trabajo sin commitear antes de una operación 🔴.
- ❌ `launchctl kickstart` desde el agente para "aplicar" un cambio: mata el turno que lo ejecuta.
- ❌ Reintentar en bucle una operación que crashea: acerca el contador a 10 y desactiva el agente.

## Relación con otros skills

- `sync-fork-upstream`: el sync de upstream (usa este protocolo para la fase de build).
- `reiniciar-server-dsh`: procedimiento del reinicio del proceso y su verificación.
