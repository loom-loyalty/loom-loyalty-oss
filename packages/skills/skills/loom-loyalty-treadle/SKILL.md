---
name: loom-loyalty-treadle
description: Drives treadle, the Loom Loyalty CLI (`npx @loom-loyalty/cli`, bin `treadle`), to manage an organization's program configuration from one `loom-loyalty-config.yaml` file. Use when a developer wants to write, validate, plan, apply, pull, promote or diff loyalty configuration (programs, currencies, tiers, rules, offers, flows) as code instead of in the dashboard.
license: Apache-2.0
---

# treadle: configuration as code for Loom Loyalty

treadle reads `loom-loyalty-config.yaml`, compares it with the live organization, and applies the difference. The file belongs in git and is reviewed like code.

```text
treadle pull  ->  edit the file  ->  treadle plan  ->  developer reviews  ->  treadle apply  ->  approve in production
```

For what to put in the file (tier ladders, event rules vs flows, multipliers), see the loom-loyalty-program-design skill. This skill covers the tool only.

## Ground rules

1. **Never apply unseen.** Run `treadle plan`, show the developer the full output, and wait for them to say it is fine. Only then run `treadle apply`.
2. **Never put a key on the command line or in a file you write.** Use the `LOOM_API_TOKEN` environment variable.
3. **Apply targets the environment the credentials belong to**, normally Development. Production changes only through `apply --env <code>`, which opens approval requests. Nothing is live in production until a person approves them in the dashboard.
4. **Removing a record from the file never deletes it** in the organization. Say so before the developer relies on it.
5. Configuration as code is in early access. If commands fail because the feature is off, tell the developer to ask their Loom Loyalty contact to enable it. Do not guess around it.

## Run it

```bash
npx @loom-loyalty/cli plan          # or, with the package installed: treadle plan
```

Needs Node.js 18.2 or later. Commands below use the bare `treadle` name.

| Command                      | What it does                                                 | Writes                             |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| `treadle pull --code <code>` | Writes the live configuration to the file                    | the file only                      |
| `treadle plan`               | Shows what apply would do to each record                     | nothing                            |
| `treadle apply`              | Shows the plan, asks to confirm, applies                     | the environment of the credentials |
| `treadle apply --env <code>` | Applies, then opens approval requests into that environment  | that environment plus the requests |
| `treadle status`             | Lists approval requests still waiting for the file's records | nothing                            |

Common options: `-f, --file <path>` (default `loom-loyalty-config.yaml`), `-t, --token <token>`, `-h, --help`. `plan` and `apply` also take `--env <code>`; `apply` takes `-y, --yes`; `pull` takes `--code <code>`, `--program <code>` and `--force`. Full list: [command reference](references/commands.md).

## Authenticate

In order of preference:

1. `LOOM_API_TOKEN` set to an `llk_...` API key with the `org-admin` role for the Development environment. Create keys in the dashboard under Developers, API Keys.
2. `--token` / `-t`. Works, but the key lands in shell history. Avoid.
3. No token: treadle opens a browser login. This is unavailable when the `CI` environment variable is set, so CI must use a key.

If no key is set and the session is non-interactive, stop and ask the developer. Do not invent credentials.

## Write and validate the file

A file has `schema: loom-loyalty-config.v1`, a `code` (lower-case letters, digits, single hyphens, at most 63 characters), an optional `name`, then any of these sections: `dataModels`, `metadataTypes`, `metadata`, `eventTypes`, `identifierTypes`, `programs`, `expiryRules`, `pendingRules`, `programCurrencies`, `tiers`, `badges`, `targets`, `eventRules`, `customerAudiences`, `offers`, `flows`, `hub`. Details: [config reference](references/config-file.md). A small example: [worked example](references/example-config.md).

- Every record has a `code`, matched against the live record. References between records use codes (`programCodes`, `tierCode`, `targetCode`, `badgeCode`), never ids.
- A key left out keeps its live value.
- At most 500 records per section. A code may not repeat within a section.
- There is no offline validate command. treadle checks the structure before any network call, so `treadle plan` is the validation step. Field-level errors come back from the server when it plans.

Start from `treadle pull` output when the organization already exists. Copy the shape of records the server wrote rather than writing fields from memory.

## Existing organization: bring it under a file

1. `treadle pull --code <code>`. Read every warning it prints. It leaves out records another file or a catalog package manages, and sections the key cannot read.
2. Delete from the file anything the developer does not want managed this way. Commit.
3. `treadle plan`. Every record should be `ADOPT` or `UNCHANGED`. A `CREATE` or `UPDATE` means the file and the organization differ; resolve before applying.
4. `treadle apply`, then `treadle plan` again. It should exit 0.

`pull` refuses to overwrite an existing file without `--force` and drops its comments. To pull one program and what it uses, add `--program <program-code>`.

## Change configuration

1. Edit the file on a branch. Run `treadle plan` and show the output.
2. After the developer approves, apply. An agent has no terminal to type into, so run `treadle apply --yes`, and only after step 1 was approved. With `--yes`, apply does not stop to show its plan, and it only catches changes made while it runs. If the file or the organization may have changed since the developer saw the plan, run `treadle plan` again and get a fresh yes first.
3. For production, `treadle apply --env <production environment code>`. It prints one approval request per record type. Then `treadle status` until it reports no requests are waiting.

## Read a plan

| Symbol | Result      | Meaning                                                          |
| ------ | ----------- | ---------------------------------------------------------------- |
| `+`    | `CREATE`    | No record has this code; apply creates it                        |
| `&`    | `ADOPT`     | Record exists; the file takes it over unchanged                  |
| `~`    | `UPDATE`    | Record differs from the file; apply changes it                   |
| `=`    | `UNCHANGED` | Already matches                                                  |
| `!`    | `CONFLICT`  | The file cannot take this record. Nothing is applied until fixed |
| `x`    | `BLOCKED`   | Record is live and the credentials lack permission to change it  |

Exit codes for `plan`: **0** nothing would change, **2** something would, **1** error, conflict or blocked record. CI can gate on this.

## Drift

Someone can edit a managed record in the dashboard or Hub. `treadle plan` then shows `UPDATE` and exits 2. Ask the developer which side wins:

- Discard the live edit: `treadle apply` (after review).
- Keep it: `treadle pull -f live.yaml`, copy the change into the committed file, plan until it exits 0.

Suggest running `treadle plan` on a schedule in CI so drift is found before an apply overwrites it. See [troubleshooting](references/troubleshooting.md) for common failures.
