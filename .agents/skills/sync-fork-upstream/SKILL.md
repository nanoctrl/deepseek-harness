---
name: sync-fork-upstream
description: |
  Usar para traer las actualizaciones del repositorio upstream de DeepSeek a
  un fork/clone personal con trabajo local propio (no colaborativo). Chequea si
  upstream avanzó, integra origin/master por merge en la branch de trabajo,
  resuelve conflictos, verifica build/tests y pushea al fork. Incluye la regla
  crítica de no reconstruir artefactos del cliente desde el agente DSH (el
  rebuild mata la sesión). No aplica a repos sin divergencia local: ahí el sync
  es fast-forward trivial.
---

# Sincronizar el fork con upstream

Protocolo para un fork personal de `deepseek-harness` que contiene trabajo local que upstream no tiene (paquetes nuevos, modificaciones propias). El objetivo es conservar lo local **y** traer las novedades del repo oficial de DeepSeek.

## ⚠️ Regla crítica: reconstruir artefactos desde el agente mata la sesión

El agente DSH corre **dentro** del proceso del Web GUI (`com.nanoctrl.dsh`, `KeepAlive=true`). Reconstruir los artefactos del **cliente** reescribe los bundles que ese mismo proceso sirve y observa por HMR: el proceso muere, el LaunchAgent lo relanza, y **la sesión del agente muere con él**. Se pierde el hilo de la conversación y el control de la operación a mitad de camino — el usuario queda sin agente y tiene que resolver desde una terminal externa.

Reparto de responsabilidades:

| Paso | Quién lo corre | Por qué |
|---|---|---|
| `git fetch / merge / commit / push`, resolver conflictos | Agente | No toca artefactos servidos |
| `pnpm install`, `pnpm run typecheck`, `pnpm test`, `pnpm run test:gui` | Agente | Seguros: no reescriben los bundles del cliente |
| `pnpm run build`, `build:lib:client`, `build:web` | **Usuario, en terminal externa** | Reescriben los artefactos que el GUI sirve |

El agente **prepara el código y pushea**; el rebuild de artefactos lo hace el humano en una terminal normal (Terminal.app, iTerm) o por CLI (`claude`, `codex`).

Si el agente tiene que reconstruir igual (no hay terminal externa disponible): avisar al usuario **en el mismo mensaje y antes de correrlo**, dejar el comando de recuperación a mano, y ejecutarlo como **último** paso — nada posterior puede depender de la sesión.

Recuperación si la sesión muere: el server vuelve solo por KeepAlive; verificar con `reiniciar-server-dsh` (sección "Verificar") y usar el `RECOVERY.md` del fork para volver a un estado conocido.

## Por qué no es un "sync fork" de GitHub

El botón *Sync fork* de GitHub y los workflows de sync asumen que el master del fork es un fast-forward de upstream (sin trabajo local). Con commits propios el push deja de ser fast-forward y GitHub no puede sincronizar solo. La integración se hace localmente con **merge** (preserva la historia local) y se pushea el resultado.

## Check: ¿hay novedades en upstream?

```sh
git fetch origin                          # origin apunta al repo oficial (deepseek-ai)
git rev-list --count master..origin/master     # novedades de upstream que faltan
git rev-list --count origin/master..master     # trabajo local que upstream no tiene
```

- `master..origin/master` > 0 → hay actualizaciones que traer.
- `origin/master..master` > 0 → hay trabajo local que se conserva (y que puede conflictuar).
- `git log --oneline master --not origin/master` → qué commits locales son propios.
- El working tree debe estar limpio antes de integrar: `git status --porcelain` vacío. Si hay WIP, commitearlo o stasharlo primero (nunca integrar con cambios sin commitear).

## Integrar (merge)

En la branch de trabajo (normalmente `master`, la que refleja tu fork):

```sh
git checkout master
git merge origin/master --no-edit
```

- Si no hay conflictos, terminó: verificar y pushear.
- Si hay conflictos, git los lista por archivo:

```sh
git status --short           # archivos en conflicto (UU/AA)
```

Resolver cada uno: los paquetes nuevos locales (instance-monitor, delete-session, voice-dictation, …) no existen en upstream → se conservan solos. Los conflictos reales aparecen en archivos que **ambos** tocaron (ej. `packages/bundle/web-app/cordis.patch.yml`, `package.json`, `Rows.tsx`, `pnpm-lock.yaml`): ahí hay que unir ambas intenciones a mano — sumar filas/dependencias, no reemplazar.

Reglas de resolución:

- **Nunca** resolver con `git checkout --theirs` o `--ours` a ciegas: decidí fila por fila qué se queda.
- `pnpm-lock.yaml` conflictivo: resolver a mano o regenerar con `pnpm install` tras el merge.
- Al terminar: `git add <archivos>` y `git commit` (completa el merge).

## Analizar qué puede romper tu trabajo

Un merge que resuelve conflictos **no garantiza que tu trabajo siga funcionando**: upstream puede haber eliminado, renombrado o cambiado la API de algo de lo que tu fork depende. Antes de dar el merge por terminado, hacer este análisis.

1. **Detectar breaking changes de upstream** (en el rango que traés):

```sh
git log --oneline master..origin/master | grep -iE 'remove|rename|delete|refactor|break|deprecat'
git diff --stat master origin/master | grep -iE 'delete|rename'
```

Los commits `type(scope)!:` (conventional commits) y las palabras `remove`/`rename`/`delete` señalan que algo dejó de existir o cambió de nombre.

2. **Cruzar con lo que tu fork depende.** Listar los paquetes propios del fork (los que no existen en upstream) y, para cada uno, confirmar que sus dependencias de upstream siguen vivas:

```sh
# paquetes que tu trabajo local agrega (ausentes en upstream)
git diff --name-only master origin/master --diff-filter=A -- 'packages/*/*/package.json'
# imports de un paquete propio hacia otros @deepseek-ai/dsh-* (revisar que sigan existiendo)
grep -rho "@deepseek-ai/dsh-[a-z0-9-]*" packages/<grupo>/<tu-paquete>/src | sort -u
```

3. **Los conflictos `modify/delete` son la señal crítica.** Significan que upstream **eliminó o renombró** un archivo que tu fork **modificó**. No se resuelven "uniendo líneas": hay que **portar** la feature a la estructura nueva de upstream, o descartarla. Ejemplo real de este fork: `delete-session` agregaba SQL a `session-persistence-sqlite`, y upstream eliminó ese backend (`refactor(session)!: remove SQLite persistence backend`) — la feature hay que reimplementarla sobre el backend nuevo (`jsonl`), no mergearla.

4. **Decisión explícita por feature afectada.** Para cada paquete propio cuyo soporte de upstream cambió, elegir y anotar en el mensaje del merge commit:
   - **Portar**: reimplementar la feature sobre la API/backend nuevo de upstream.
   - **Descartar**: si upstream ya cubre la feature, quitar la versión local.
   - **Aislar**: si la versión local es independiente, dejarla tal cual.

## Verificar después del merge

Con los conflictos resueltos, verificar que el conjunto compile y pase sus tests antes de pushear. **Esta sección entera es segura desde el agente**: ninguno de estos comandos reescribe los bundles del cliente que el GUI sirve.

```sh
pnpm install               # regenerar el lock si el merge tocó dependencias
pnpm run typecheck         # delata imports rotos (paquetes que upstream borró/renombró)
pnpm run test:gui          # suites del cliente + host GUI (inner loop)
```

`pnpm run build` queda **fuera** de esa lista a propósito: reconstruye los artefactos del cliente y mata la sesión (ver la regla crítica arriba). El rebuild completo es un paso del **usuario**, después del push — el agente no puede ejecutarlo ni verificarlo en la misma sesión.

Confirmar además que cada paquete propio del fork siga presente y su feature funcione:

```sh
ls packages/host/instance-monitor packages/host/delete-session packages/host/voice-dictation packages/client/ui-voice-dictation
```

Si algo falla o un paquete propio desapareció, corregirlo antes de pushear. No pushear esperando que CI lo arregle.

## Push al fork

```sh
git push dsh-nanoctrl-fork master        # el fork queda con upstream + tu trabajo
git rev-parse HEAD dsh-nanoctrl-fork/master   # deben coincidir
```

Si el fork master ya divergió del resultado local (por ejemplo, syncs anteriores), el push es non-fast-forward y git lo rechaza: verificar qué hay en `dsh-nanoctrl-fork/master` antes de forzar. `--force-with-lease` solo con la lease exacta, nunca `--force` a secas.

## Branches feature

Después de actualizar `master`, las branches de trabajo (ej. `feat/…`) que nacieron del master viejo pueden integrar el master nuevo:

```sh
git checkout feat/mi-cambio
git merge master
```

Mismo tratamiento de conflictos. Así cada branch queda sobre la última base.

## Cuándo no usar este protocolo

- Repo sin trabajo local (master = espejo de upstream): alcanza `git merge --ff-only origin/master` (o el botón Sync fork).
- Rewrite de la historia local deliberado (rebase): es una decisión distinta, no un sync.

## Riesgos

- El **primer** merge es el más grande: acumula toda la divergencia (1313+ commits de upstream contra 3300+ líneas locales). Los siguientes son incrementales.
- Los conflictos de `cordis.patch.yml` / `package.json` del bundle web-app son los más probables y los que más cuidado requieren (ambos lados agregan filas).
- Verificar siempre build + tests tras el merge: un sync que rompe el build no es un sync. Los tests los corre el agente; el **build lo verifica el usuario** desde una terminal externa (ver la regla crítica).
- **El rebuild se auto-sabotea**: correr `pnpm run build` desde el agente mata el proceso que hospeda la sesión. Es el riesgo con peor relación daño/previsibilidad: no falla el build, falla *el entorno del que lo corre*. Preparar y pushear desde el agente; reconstruir desde afuera.
