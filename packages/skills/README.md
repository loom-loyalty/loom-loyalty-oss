# @loom-loyalty/skills

Agent skills that teach AI agents to work with [Loom Loyalty](https://www.loomloyalty.com/). They follow the open Agent Skills format, so Claude, Claude Code, Codex and other agents can load them.

| Skill                         | For        | What it teaches                                                              |
| ----------------------------- | ---------- | ---------------------------------------------------------------------------- |
| `loom-loyalty-treadle`        | Developers | Configuration as code with treadle: config file, plan, apply, pull and drift |
| `loom-loyalty-api`            | Developers | Auth, environments, errors, pagination, events and the SDK                   |
| `loom-loyalty-program-design` | Everyone   | Modelling tiers, currencies, rules, flows and offers well                    |
| `loom-loyalty-campaign`       | Marketers  | Turning a campaign goal into a checked, approved rule or flow                |
| `loom-loyalty-offer`          | Marketers  | Drafting an offer with its audience and dates                                |
| `loom-loyalty-analytics`      | Marketers  | Reading program, campaign, tier and offer results                            |

The marketer skills work through the Loom Loyalty connector (`https://mcp.loomloyalty.com/mcp`) and never publish or turn anything on until you say yes.

## Install

```bash
npx @loom-loyalty/skills install          # copies the skills into .claude/skills/
npx @loom-loyalty/skills install --agents # or into .agents/skills/
npx @loom-loyalty/skills install --list   # shows them without installing
```

An installed skill is left alone on a second install; pass `--force` to replace it.

In Claude and Cowork, install the `loom-loyalty-marketing` plugin from this repository's plugin marketplace instead. It adds the connector too.

## License

Apache License 2.0.
