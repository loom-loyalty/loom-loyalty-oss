# treadle command reference

Verified against the CLI source (`treadle help` and each command's `--help`). Run `treadle <command> --help` to confirm on the installed version.

## Top level

```text
treadle <command> [options]

generate    Download the OpenAPI spec and regenerate an API client (default when no command is given)
plan        Show what applying loom-loyalty-config.yaml would change
apply       Apply loom-loyalty-config.yaml; --env promotes through the approval workflow
status      List workflow requests waiting for the file's records
pull        Write the organization's live configuration to loom-loyalty-config.yaml
config      Hub configuration files (generate, push, pull, validate)
help        Show help
version     Show the version
```

`treadle schema` was removed. Data models are declared in the `dataModels` section and applied with `treadle apply`.

## plan, apply, status

| Option                | Applies to  | Meaning                                                                                                            |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `-f, --file <path>`   | all three   | Config file. Default `loom-loyalty-config.yaml`                                                                    |
| `--env <code>`        | plan, apply | Organization environment to promote into, such as `prod`. `status` does not take it                                |
| `--deployment <name>` | all three   | `production`, `staging` or `development`. Default `production`. Leave it unset unless the developer says otherwise |
| `-t, --token <token>` | all three   | Skip browser login. A session token or an `llk_` API key. Prefer `LOOM_API_TOKEN`                                  |
| `-y, --yes`           | apply       | Apply without the interactive confirmation                                                                         |
| `-h, --help`          | all three   | Help                                                                                                               |

Behaviour:

- `plan` exits 0 (no change), 2 (changes), 1 (error, conflict or blocked). With `--env` it shows the plan including promotion into that environment and opens nothing.
- `apply` runs the plan first. A conflict or blocked record stops it before any write. Without `--yes` it asks for the word `yes` on a terminal. With no terminal and no `--yes` it declines. After confirmation it re-plans on the server and refuses with "the plan changed since it was shown" if the organization moved in between.
- `apply --env <code>` also opens approval requests for records not yet in that environment. Nothing is enabled there until each request is approved. If a request fails to open, apply exits 1; run it again to retry the rest.
- `status` prints the open approval requests carrying the file's records, or says none are waiting. If the file was never applied it says so.

## pull

| Option                                                     | Meaning                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `-f, --file <path>`                                        | File to write. Default `loom-loyalty-config.yaml`                                       |
| `--code <code>`                                            | The file's `code`. Defaults to the existing file's code. Required when there is no file |
| `--program <code>`                                         | Pull one program and everything it uses                                                 |
| `--force`                                                  | Overwrite an existing file. Its comments are not kept                                   |
| `--deployment <name>`, `-t, --token <token>`, `-h, --help` | As above                                                                                |

Pulling is deterministic: sections in schema order, records by code, no timestamp. Pulling an unchanged organization changes no byte, so a git diff shows only real changes. Applying the pulled file back changes nothing, so `plan` exits 0 right after. Warnings (records left out, a section the key cannot read) are printed after the write.

## generate

Authenticates, downloads the OpenAPI spec to `openapi.yaml` at the repository root, then runs `pnpm --filter @loom-loyalty/sdk generate`. It only makes sense in a repository that has that workspace package. Options: `-d, --dashboard-url <url>`, `-t, --token <token>`, `--skip-generate` (download the spec only), `--cwd <path>`, `-h, --help`.

## config

`treadle config generate | validate | push | pull` manage a Hub configuration file (`hub.config.ts`). `push` and `pull` take `--org <slug>` and `--deployment`; `push` also takes `-c, --config <path>` and `--dry-run`. The `hub:` section of `loom-loyalty-config.yaml` replaces push and pull for theme, UI settings, entity overrides and feature flags. Use `config push` only to create a hub or set its custom components.

## Environment variables

| Variable         | Use                                                                     |
| ---------------- | ----------------------------------------------------------------------- |
| `LOOM_API_TOKEN` | Credential for plan, apply, status, pull. Used when `--token` is absent |
| `CI`             | When set, browser login is refused; supply a key                        |
