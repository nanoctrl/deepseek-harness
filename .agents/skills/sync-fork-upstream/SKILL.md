---
name: sync-fork-upstream
description: Usar para traer las actualizaciones del repositorio upstream de DeepSeek a un fork/clone personal con trabajo local propio (no colaborativo). Chequea si upstream avanzó, integra origin/master por merge en la branch de trabajo, resuelve conflictos, verifica build/tests y pushea al fork. No aplica a repos sin divergencia local: ahí el sync es fast-forward trivial.
---

# Sincronizar el fork con upstream

Protocolo para un fork personal de `deepseek-harness` que contiene trabajo local que upstream no tiene (paquetes nuevos, modificaciones propias). El objetivo es conservar lo local **y** traer las novedades del repo oficial de DeepSeek.

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

Con los conflictos resueltos, verificar que el conjunto compile y pase sus tests antes de pushear:

```sh
pnpm install               # regenerar el lock si el merge tocó dependencias
pnpm run typecheck         # delata imports rotos (paquetes que upstream borró/renombró)
pnpm run build             # tsc + bundle de todas las caras
pnpm run test:gui          # suites del cliente + host GUI (inner loop)
```

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
- Verificar siempre build + tests tras el merge: un sync que rompe el build no es un sync.
