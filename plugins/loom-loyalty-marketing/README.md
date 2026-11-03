# Loom Loyalty Marketing

Launch campaigns and offers, and read their results, from Claude. This plugin connects Claude to your Loom Loyalty organization and adds skills that walk through the work safely. Nothing goes live until you say yes.

## What it includes

- **The Loom Loyalty connector:** the remote MCP server at `https://mcp.loomloyalty.com/mcp`. You sign in with your Loom Loyalty account, and Claude can only do what your role allows.
- **Skills:**
  - `loom-loyalty-campaign` plans and launches a campaign.
  - `loom-loyalty-offer` drafts, tests and publishes an offer.
  - `loom-loyalty-analytics` reads results and answers questions about members and activity.
  - `loom-loyalty-program-design` designs programs, tiers, currencies and earning rules.

## Setup

1. Install the plugin. In Claude Code, run:

   ```
   /plugin install loom-loyalty-marketing --marketplace loom-loyalty/loom-loyalty-oss
   ```

   In Claude, add it from the plugin directory.

2. When Claude asks you to connect Loom Loyalty, sign in with your Loom Loyalty account and choose an organization and environment.
3. Try a prompt such as "What programs and tiers do I have?" or "Draft a double points weekend offer, but don't publish it."

You need a Loom Loyalty account. Try changes in a Development environment first.

## Documentation

https://docs.loomloyalty.com/docs/guide/connect-ai-assistants/

## Privacy

The connector sends your requests to the Loom Loyalty API, and the data stays in your Loom Loyalty organization. See the [Loom Loyalty privacy policy](https://www.loomloyalty.com/privacy). The plugin itself stores nothing.

## Support

support@loomloyalty.com

## License

Apache-2.0
