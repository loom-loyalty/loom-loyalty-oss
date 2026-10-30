# loom-loyalty-config.yaml reference

Schema name: `loom-loyalty-config.v1`. JSON is also accepted, since it is valid YAML.

## Top level

| Key      | Required | Notes                                                                                                        |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `schema` | yes      | Must be exactly `loom-loyalty-config.v1`                                                                     |
| `code`   | yes      | The file's identity. Lower-case letters, digits and single hyphens, at most 63 characters. One file per code |
| `name`   | no       | Display name                                                                                                 |
| sections | no       | Any of the sections below. An unknown top-level key is rejected                                              |

## Sections

| Section                       | Holds                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `dataModels`                  | Custom fields for events and entities                                             |
| `metadataTypes`, `metadata`   | Controlled vocabularies and their values (`metadata` entries have `type`, `code`) |
| `eventTypes`                  | Event types, each with `code`, optional `name`, `description`, `dataModel`        |
| `identifierTypes`             | Customer identifier types                                                         |
| `programs`                    | Loyalty programs                                                                  |
| `expiryRules`, `pendingRules` | When balances expire, and when earned points become usable                        |
| `programCurrencies`           | Points, miles, stars and so on, per program                                       |
| `tiers`                       | Membership levels, with a `rank` (lower number is higher)                         |
| `badges`, `targets`           | Achievements and counters                                                         |
| `eventRules`                  | One event to immediate actions                                                    |
| `customerAudiences`           | Lists and segments                                                                |
| `offers`                      | Rewards and coupons                                                               |
| `flows`                       | Multi-step journeys with waits and branches                                       |
| `hub`                         | Settings of the Hub for the environment the file is applied in                    |

Program-level records (`programs` through `flows` except `hub`) are the API's create body for that resource, matched by `code`. The CLI only checks that each has a valid `code`. The server validates the rest when it plans, and returns the reason a record plans as `CONFLICT`. Easiest way to learn a record's fields: run `treadle pull` on an organization that has one, or read the matching create operation in the API reference at https://docs.loomloyalty.com.

## Rules

- **Codes, not ids.** References use `programCodes`, `tierCode`, `targetCode`, `badgeCode`, `programCurrencyCode`, `eventTypeCode`. The server resolves ids when it applies.
- **Omitted keys keep their live value.** Deleting a key from the file does not clear it.
- **At most 500 records per section.**
- **No duplicate codes** within a section (for `metadata`, within a type).
- **Removed records are not deleted.** A record removed from the file stays live and stays owned by the file's ledger. To retire it, archive or delete it in the dashboard.
- **One owner per record.** A record another file or a catalog package manages plans as `CONFLICT`.

## Stays outside the file

The organization itself, its environments, roles, API keys and secrets; system records seeded at organization creation; the Hub's subdomain, custom domain, name and custom components.

## Flows

A flow carries a `triggerEventTypeCode` and a `graph` with an `entryStepKey` and `steps`. The graph is validated like an API request, so an invalid graph plans as `CONFLICT` with the validator's message. Changing a flow whose latest version is published creates a new draft version; changing a draft edits it in place. An archived flow cannot be changed from the file. When to choose a flow over an event rule: see the loom-loyalty-program-design skill.

## Hub

```yaml
hub:
  theme: { primaryColor: "#1f6feb" }
  uiSettings: { defaultListView: table }
  entityOverrides: { customers: { label: Guests } }
  featureFlags: { showApiExplorer: true }
```

Only these four settings are accepted. A setting replaces the live one whole, so declare all of `theme` or none of it. The environment must already have a hub. `apply --env` copies the four settings onto the target environment's hub when the request is approved.
