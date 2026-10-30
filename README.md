# Loom Loyalty open-source packages

The SDK, CLI, UI kit and agent skills for building on [Loom Loyalty](https://www.loomloyalty.com/), the loyalty platform. They are licensed under the [Apache License 2.0](LICENSE).

| Package                                                             | What it is                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`@loom-loyalty/sdk`](packages/sdk)                                 | Typed API client, React Query hooks and Zod schemas for the Loom Loyalty API                                 |
| [`@loom-loyalty/cli`](packages/cli)                                 | treadle, the Loom Loyalty CLI: configuration as code (`plan` / `apply`), spec download and client generation |
| [`@loom-loyalty/skills`](packages/skills)                           | Agent skills for treadle, the API, program design, campaigns, offers and analytics                           |
| [`@loom-loyalty/core`](packages/core)                               | Provider interfaces, hooks, types and utilities                                                              |
| [`@loom-loyalty/ui`](packages/ui)                                   | React component library (Radix and Tailwind)                                                                 |
| [`@loom-loyalty/schema`](packages/schema)                           | Schema parser, field type registry and UI generation                                                         |
| [`@loom-loyalty/program-builder`](packages/program-builder)         | Loyalty program templates and builders                                                                       |
| [`@loom-loyalty/analytics`](packages/analytics)                     | Analytics queries and views                                                                                  |
| [`@loom-loyalty/auth`](packages/auth)                               | WorkOS authentication helpers                                                                                |
| [`@loom-loyalty/notifications-knock`](packages/notifications-knock) | Knock adapter for the notification feed                                                                      |
| [`@loom-loyalty/conventions`](packages/conventions)                 | Shared naming conventions                                                                                    |
| [`@loom-loyalty/config`](packages/config)                           | Shared TypeScript, ESLint and build configs                                                                  |

## Getting started

```bash
npm install @loom-loyalty/sdk
npx @loom-loyalty/cli --help
```

The API reference is at [docs.loomloyalty.com](https://docs.loomloyalty.com/).

## Agent skills

The skills teach AI agents to work with Loom Loyalty. Add them to a project for Claude Code, Codex or another coding agent:

```bash
npx @loom-loyalty/skills install          # into .claude/skills/
npx @loom-loyalty/skills install --agents # into .agents/skills/
```

This repository is also a Claude plugin marketplace with two plugins:

- **loom-loyalty-marketing**: campaigns, offers, analytics and program design, plus the Loom Loyalty connector. For marketers in Claude and Cowork.
- **loom-loyalty-developer**: treadle, the API and program design. For developers in Claude Code.

```text
/plugin marketplace add loom-loyalty/loom-loyalty-oss
/plugin install loom-loyalty-marketing@loom-loyalty
```

Claude plans without plugins can download each skill as a zip from [docs.loomloyalty.com](https://docs.loomloyalty.com/).

## Development

```bash
pnpm install
pnpm build
pnpm test
```

This repository is synced weekly from Loom Loyalty's private monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for how contributions flow back.

## License

Apache License 2.0. "Loom Loyalty" is a trademark of Loom Loyalty, Inc.; see [TRADEMARKS.md](TRADEMARKS.md).
