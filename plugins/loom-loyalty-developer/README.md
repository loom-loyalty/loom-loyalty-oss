# Loom Loyalty Developer

Set up and maintain a Loom Loyalty tenant from Claude Code, with treadle (the Loom Loyalty CLI), the API and the SDK.

## What it includes

- **Skills:**
  - `loom-loyalty-treadle` keeps a tenant's configuration in a file, then plans and applies it with treadle.
  - `loom-loyalty-api` calls the Loom Loyalty REST API and SDK the right way.
  - `loom-loyalty-program-design` designs programs, tiers, currencies and earning rules.

## Setup

1. Install the plugin. In Claude Code, run:

   ```
   /plugin install loom-loyalty-developer --marketplace loom-loyalty/loom-loyalty-oss
   ```

   In Claude, add it from the plugin directory.

2. Run treadle with `npx @loom-loyalty/cli` (the command is `treadle`).
3. Ask Claude to pull your tenant's configuration, change it, and plan the change before applying it.

You need a Loom Loyalty account. Try changes in a Development environment first.

## Documentation

https://docs.loomloyalty.com

## Privacy

The skills run in your session and call the Loom Loyalty API only through the tools you run, using your own credentials. See the [Loom Loyalty privacy policy](https://www.loomloyalty.com/privacy). The plugin itself stores nothing.

## Support

support@loomloyalty.com

## License

Apache-2.0
