---
name: buenas-practicas-github
description: Usar al gestionar repositorios de GitHub desde DSH — crear y nombrar remotes, autenticar (SSH vs gh vs keychain), crear forks, separar trabajos al commitear, pushear de forma limpia y segura, y abrir/verificar pull requests. Resume las trampas reales: SSH no crea forks, el keychain puede ser invisible para el sandbox, y los pushes non-fast-forward.
---

# Buenas prácticas: gestión de GitHub y pushes

Guía operativa para trabajar con repositorios de GitHub desde DSH. Complementa a `dsh-pre-push-checks` (ese skill elige qué *tests* correr antes de pushear; este cubre la mecánica de remotes, autenticación, forks, commits y pushes).

## Remotes y su nombre

- `origin` es el upstream (ej. `deepseek-ai/deepseek-harness`), normalmente solo lectura.
- El fork personal vive en tu cuenta (ej. `nanoctrl/deepseek-harness`) y se agrega como remote aparte:

```sh
git remote add <nombre-descriptivo> git@github.com:<usuario>/<repo>.git
git remote -v   # verificar
```

- Nombra el remote con un alias claro (`dsh-nanoctrl-fork`) en vez de pisar `origin`: así distinguís qué es upstream y qué es tuyo sin adivinar.

## Autenticación: qué puede hacer cada vía

| Vía | Puede | No puede |
|---|---|---|
| SSH (`git@github.com:...`) | push/fetch/clone sobre repos **existentes** | crear repos o forks |
| `gh` CLI (token) | todo, incluida la API (crear forks/repos, PRs) | nada sin token válido |
| Browser | crear forks/repos, tokens PAT | nada programático |

- **SSH no crea forks.** Crear un fork (o cualquier repo) pasa por la API web de GitHub y exige un token. Si `git ls-remote git@github.com:<user>/<repo>.git` devuelve `Repository not found`, el repo no existe: no lo vas a "crear" con un push.
- `gh auth login -h github.com`: el token puede quedar en el **keychain de macOS** (`gh auth status` muestra `(keyring)`) o en `~/.config/gh/hosts.yml`. Ambos son válidos en tu terminal.
- **El sandbox de DSH puede no leer el keychain.** Si `gh` en mis procesos dice `token invalid` pero en tu terminal está `✓ Logged in`, el token está en el keyring y yo no lo veo. Solución: los comandos que necesitan el token (`gh repo fork`, `gh pr create`) los corrés vos en tu terminal; el push lo hago yo por SSH.
- Verificaciones rápidas:

```sh
gh auth status        # ✓ Logged in … (keyring|hosts.yml)
gh api user           # sin 401 ⇒ token OK
git ls-remote git@github.com:<user>/<repo>.git   # repo existe ⇒ lista refs
```

## Crear forks

```sh
gh repo fork deepseek-ai/deepseek-harness --clone=false
```

- **No combines `--remote` con un argumento de repositorio**: `gh repo fork <repo> --remote=false` falla con `the "--remote" flag is unsupported when a repository argument is provided`. Usá `--clone=false` solo.
- Alternativa manual: botón **Fork** en el browser.
- Después del fork, el repo destino ya responde a `git ls-remote` (deja de ser `Repository not found`).

## Commits: separá los trabajos

- Stageá selectivamente, nunca `git add -A` cuando hay cambios ajenos (WIP de otra tarea) en el árbol:

```sh
git add packages/.../archivo.ts ...   # solo lo tuyo
git diff --cached --name-only         # auditar qué entró
git status --porcelain                # confirmar qué quedó fuera
```

- Mensajes en español con formato `tipo(scope): descripción` (`feat`/`fix`/`refactor`/`docs`/`style`/`test`/`chore`).
- Cambios no triviales llevan un Agent Note en el mismo commit (`.agents/notes/README.md`): formato y gate en `verify-agent-note-format`.
- Hooks pre-commit del repo: lint `--fix` sobre lo stageado, whitespace y vendor guard corren solos; si el lint reescribe algo, revisá lo re-stageado antes de continuar.

## Pushes: limpios y verificables

- Trabajá en una branch feature, no en `master` del checkout.
- Antes de pushear, compará contra upstream:

```sh
git fetch origin master
git log --oneline $(git merge-base HEAD origin/master)..origin/master -- <tus-archivos>
```

  Si upstream tocó tus archivos, un rebase futuro tendrá conflictos — decidilo antes de abrir el PR, no después.

- Push normal (el hook pre-push corre `typecheck`):

```sh
git push <fork-remote> <branch>
git rev-parse HEAD <fork-remote>/<branch>   # deben coincidir
```

- **Non-fast-forward se rechaza.** Un rewrite autorizado usa lease exacta, nunca `--force` a secas: `git push --force-with-lease=<branch>:<oid-observado>`.
- Si tu branch nació de un `master` local con commits que upstream no tiene, el push lleva esos commits de más; para un PR limpio hay que rebasear sobre upstream (y resolver conflictos).

## Pull requests

- Crear desde el link que GitHub imprime al pushear, o `gh pr create`.
- Verificar CI: `gh pr checks`. Si reporta "no checks" y el PR está `CONFLICTING`/`DIRTY`, el conflicto es la causa: resolverlo es la única solución (los commits vacíos/`--allow-empty` no generan runs).
- Antes de marcar ready o claim checks, cargar `dsh-pre-push-checks` y correr la evidencia relevante del diff saliente.
