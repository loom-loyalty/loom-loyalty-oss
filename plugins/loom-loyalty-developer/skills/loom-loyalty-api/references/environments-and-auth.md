# Environments and keys

## Tokens

A bearer token identifies one of two principals:

- **API key**: a machine-to-machine client for server-side integrations and automation. What integrations use.
- **User**: a person signed in to a first-party surface such as the dashboard. Do not build integrations on user sessions.

Header: `Authorization: Bearer <token>`.

## Creating and managing keys

1. Dashboard, Developers, API Keys, Create API Key. Give it a descriptive name.
2. Copy the `llk_<keyId>_<secret>` value. It is displayed once.
3. Store it in a secret manager or an environment variable.

Manage keys by assigning **roles**: a role is a set of permission scopes, so a key that only reads customers should not hold configuration write scopes. Rotate on a schedule and whenever someone with access leaves. Revoke immediately if a key may be exposed.

## Environments

An organization has several environments, for example Development and Production. A key belongs to one environment and acts only there. Practical consequences:

- Use a Development key while building. Reads and writes there do not touch production data.
- Rate limits are per environment, so load in one does not consume another's allowance.
- Configuration reaches production by promotion through the environment approval workflow, not by pointing a Development key at production. The treadle CLI does this with `treadle apply --env <code>`; see the loom-loyalty-treadle skill.

## AI assistants

The same actions are available to AI assistants through the remote MCP server at `https://mcp.loomloyalty.com/mcp`. The assistant signs in as the user and can do only what that user's role allows. Tool calls count against the same rate limits as the equivalent API calls (read tools as reads, write tools as writes).
