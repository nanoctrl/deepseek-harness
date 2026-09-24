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

## ⚠️ Regla crítica: el merge y el rebuild pueden matar tu propia herramienta

Hay **dos** formas de perder el control a mitad del sync, con la misma raíz: el agente vive dentro del checkout que estás modificando.

### A. El merge borra el runtime del agente (rompe `run_code` sin matar el server)

Upstream reestructura paquetes. En el salto 0.1.5 → 0.1.7 movió el runtime de ejecución de código: `packages/code-runtime/code-runtime-worker-thread/src/worker.ts` dejó de existir (pasó a `packages/ptc-runtime/`). El server viejo —que corre el código viejo— sigue vivo, pero **cada `run_code` falla con `Cannot find module ...worker.ts`**: la herramienta con la que resolvés conflictos se rompe inmediatamente después del `git merge`.

Si lanzás el merge directo desde el agente, perdés la capacidad de resolver nada y dependés de una terminal externa (Claude Code, iTerm). Es exactamente el escenario que este protocolo evita.

### B. El rebuild reescribe los bundles que el server sirve

`pnpm run build` / `build:lib:client` / `build:web` reescriben artefactos que el GUI observa por HMR: el proceso muere, `KeepAlive` lo relanza, y la sesión muere con él.

## Solución: resolver en un worktree aislado

El server **sólo observa el checkout principal**. Un `git worktree` en otro directorio es invisible para él: ahí podés mergear, resolver conflictos y verificar sin perder el agente.

```sh
# 0. Checkpoint: nada sin commitear, todo pusheado
git status --porcelain          # debe estar vacío
git push dsh-nanoctrl-fork master

# 1. Worktree en una branch propia (el principal queda intacto)
git worktree add -b sync/upstream ../dsh-sync master
cd ../dsh-sync

# 2. Merge + conflictos + verificación, todo AISLADO
git merge origin/master --no-edit
# ... resolver conflictos, git add -A, git commit ...
pnpm install
pnpm run typecheck
pnpm test                       # o test:gui para cambios de GUI

# 3. Volver al principal — el agente sigue vivo, nada se rompió
cd <checkout-principal>
```

El trabajo riesgoso (merge, conflictos, verificación) queda **hecho y verificado** sin tocar el checkout que hospeda al agente.

## Cierre controlado (el único paso que sí toca el principal)

Aplicar el resultado rompe el worker igual, así que va en **un script que corre solo**: aunque el agente muera, el script termina, reconstruye y reinicia el server.

```sh
cat > ~/.dsh/aplicar-sync.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /Users/nahuelmaeso/Desktop/claude-software/deepseek-harness
git merge sync/upstream --no-edit            # ya resuelto: sin conflictos
CI=true pnpm install --no-frozen-lockfile     # deps nuevas del upstream
pnpm run build                                # reconstruye, incluido el runtime nuevo
git push dsh-nanoctrl-fork master
git worktree remove ../dsh-sync --force
launchctl kickstart -kp gui/$(id -u)/com.nanoctrl.dsh
EOF
chmod +x ~/.dsh/aplicar-sync.sh
```

Lanzarlo **en background** (el agente muere durante el build, pero el script sigue):

```sh
~/.dsh/aplicar-sync.sh > /tmp/aplicar-sync.log 2>&1 &
```

El `kickstart` final devuelve la sesión al código nuevo. **Sin terminal externa y sin Claude Code.**

### Verificación posterior

Cuando el server vuelva:

```sh
~/.dsh/dsh-health.sh
git log -1 --oneline                          # el merge aplicado
git rev-list --count master..origin/master     # 0 = sincronizado
```

Si el worker volvió a romperse (merge de un salto que reestructura paquetes), el server ya reinició con el código nuevo: el problema se resuelve solo.

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

## Verificar después del merge (dentro del worktree)

Con los conflictos resueltos **en el worktree**, verificar que compile y pase tests. Todo esto es seguro ahí: el server no observa ese directorio.

```sh
pnpm install               # regenerar el lock si el merge tocó dependencias
pnpm run typecheck         # delata imports rotos (paquetes que upstream borró/renombró)
pnpm run test:gui          # suites del cliente + host GUI (inner loop)
```

El `pnpm run build` completo **no** va acá: es parte del cierre controlado (ver arriba), porque reconstruye los artefactos que el server principal sirve.

Confirmar que cada feature propia del fork siga **cableada**, no sólo que el paquete exista:

```sh
# 1. paquetes propios presentes
ls packages/host/voice-dictation packages/host/delete-session \
   packages/client/ui-voice-dictation packages/client/ui-delete-session

# 2. anclajes de registro (lo que el merge suele pisar)
grep -n 'voice-dictation\|delete-session' packages/bundle/web-app/cordis.patch.yml
grep -n 'voice-dictation\|delete-session' packages/bundle/web-app/package.json packages/api/remotes/package.json
grep -n 'voiceTranscribeRemote\|deleteSessionRemote' packages/api/remotes/src/client/index.ts
grep -rn 'StateDot' packages/client/ui-workspace/src/client/rows/*.tsx
```

Un paquete puede existir y **no estar cableado**: si el merge pisó un registro, la feature desaparece del GUI sin error de compilación. Revisar los anclajes, no sólo la existencia.

Si algo falla o un anclaje desapareció, corregirlo en el worktree antes de cerrar.

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
- Verificar siempre build + tests: un sync que rompe el build no es un sync. Tests en el worktree; el build va en el script de cierre.
- **Dos auto-sabotajes a evitar**: (1) el merge puede borrar el runtime del agente (`code-runtime-worker-thread` → `ptc-runtime` en 0.1.7) y romper `run_code`; (2) `pnpm run build` desde el principal mata el proceso que hospeda la sesión. El worktree aislado junto con el script de cierre resuelven ambos y evitan depender de una terminal externa.
