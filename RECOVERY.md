# Recuperación — restaurar la última versión funcional

Último recurso cuando el checkout se rompe (build corrupto, merge a medias,
working tree inconsistente) y no podés operar desde DSH. Corré esto desde una
**terminal normal** (no desde DSH):

```sh
cd /Users/nahuelmaeso/Desktop/claude-software/deepseek-harness && \
git fetch dsh-nanoctrl-fork master && \
git reset --hard dsh-nanoctrl-fork/master && \
git clean -fdx && \
pnpm install
```

Qué hace, en orden:

1. `git fetch` trae el último estado commiteado del fork (`dsh-nanoctrl-fork`).
2. `git reset --hard` pisa el working tree local con `dsh-nanoctrl-fork/master`
   (descarta **todo** lo local sin commitear).
3. `git clean -fdx` borra archivos no trackeados e ignorados (build output,
   `node_modules`, etc.).
4. `pnpm install` reinstala dependencias.

## Cómo mantenerlo actualizado

Este comando siempre apunta a `dsh-nanoctrl-fork/master`, o sea al **último
estado pusheado** al fork. Para que sea tu "última versión buena", pusheá al
fork después de cada cambio que funcione:

```sh
git push dsh-nanoctrl-fork master
```

Si olvidaste pushear, el comando te lleva al último push, no a los commits
locales sin pushear (es la versión del remote, a propósito).

## ⚠️ Destructivo

Descarta cambios locales sin commitear. No es para "deshacer una cosa"; es para
reformatear a un estado conocido y funcional.
