# Campaign tool steps

The tool-by-tool detail behind the campaign workflow. Every write tool here creates or changes a draft except the publish and enable steps, which wait for the marketer's yes.

## Finding what exists

| Need                                    | Tool                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| Programs and their ids                  | `list_programs`                                            |
| Tiers, for "Gold members"               | `list_tiers`                                               |
| Existing audiences                      | `list_customer_audiences`, `get_customer_audience_by_code` |
| Audience size                           | `get_customer_audience_count`                              |
| Existing rules                          | `list_event_rules`, `get_event_rule_by_code`               |
| Existing flows                          | `list_flows`, `get_flow_by_code`                           |
| Event types a rule or flow can react to | `list_event_types`, `get_event_type_by_code`               |
| Target environments                     | `list_environments`                                        |

## Audience

1. `build_expression` with surface customer and a plain-English prompt, for example "members in the Gold tier with no purchase in the last 90 days". Tell the marketer its assumptions. If it returns a clarifying question, ask it.
2. `preview_segment_expression` with that expression. It saves nothing and returns an estimated count, a cost level and sample customer ids.
3. `create_customer_audience` with type CUSTOMER_SEGMENT, a lower-kebab-case code, a name and the segment expression. Set triggerOnEnter to true if a flow will start when members join the segment.
4. After the marketer's yes: `publish_customer_audience_version` with the audience id and the draft's version number (from `list_customer_audience_versions` if you do not have it).

## Event rule

1. `build_expression` with surface event for the WHEN condition (pass the event type's data model code), and again with target reward for the THEN reward.
2. `create_event_rule` with category, eventTypeCode, code, name, programIds and both expressions. The result carries the draft's eventRuleId and version.
3. `backtest_event_rule` with that eventRuleId and version. Pass from and to (ISO 8601) to choose the window; the default is the 90 days before now and the limit is 365 days.
4. After the marketer's yes: `publish_event_rule` with the eventRuleId.
5. Read back with `get_event_rule` or `get_latest_published_event_rule`.

### Members of an audience on an event rule

A condition on the event can check simple facts about the member, such as their tier. A history-based audience ("lapsed", "has not visited in 60 days") often cannot be checked on the event itself. `build_expression` says so when that happens. Then the campaign is usually a flow that triggers when a member joins the audience (event type audience.member.added, with the sub-type set to the audience code), or a rule on that same event. Explain this to the marketer in one sentence.

## Flow

1. `create_flow` with code, name and triggerEventTypeCode (and an optional trigger condition, exit criteria and re-enrollment setting). It starts as draft version 1 with no steps.
2. `update_flow_graph` with the whole set of steps and the entry step. Each step can wait, check a condition, and apply effects such as issuing points. Every step must be reachable from the entry, with no loops.
3. `get_flow_graph` to read the steps back.
4. `test_flow_version` with the flowId, version, a target member (a customer from `list_customer_audience_members` or the preview's sample ids) and a sample trigger event. For steps that wait for an event, pass the event that resumes each one. Report the path taken.
5. After the marketer's yes: `publish_flow_version`.
6. Read back with `list_flow_versions`. A published version only runs in the environments it is enabled in (its enabledInEnvironments). If the target environment is missing, request it as below with entityType FLOW and the flow version's id.

To stop a flow later, use `pause_flow_version` (and `resume_flow_version`). Archiving with `archive_flow_version` cannot be undone; never do it without an explicit request.

## Enabling in an environment

Call `request_enable_in_environment` only after publishing and only when the read-back shows the record is not already enabled in the target environment.

- entityType: EVENT_RULE for a rule, FLOW for a flow (entityId is the flow version's id), CUSTOMER_AUDIENCE for a new segment.
- entityId and entityName: from the read-back.
- environmentId: from `list_environments`. If there is more than one candidate, ask which one.
- startDateTime and endDateTime: the campaign dates in ISO 8601 with the marketer's UTC offset. For "November", that is midnight on November 1 to midnight on December 1. Pass timeZone too, for example America/New_York.
- reason: a short business reason for the approver, at least 10 characters, such as "November double points for lapsed Gold members".
- aiOutputVerified: true only after the marketer has said they reviewed the draft.

The request goes through the environment's approval workflow. Tell the marketer it may be waiting for someone to approve it. Check progress with `list_workflow_requests` and `get_workflow_request`. Do not approve a request yourself unless the marketer asks you to and is an approver; the platform checks that.

## Changes after publishing

| Record     | Start a new draft                  | Edit the draft                     |
| ---------- | ---------------------------------- | ---------------------------------- |
| Event rule | `create_event_rule_version`        | `update_event_rule`                |
| Segment    | `create_customer_audience_version` | `update_customer_audience`         |
| Flow       | `create_flow_version`              | `update_flow_graph`, `update_flow` |

Check the new draft again (backtest or test run), show it, and wait for a fresh yes before publishing. A newly published flow version does not replace the old one: both run until the old one is paused. Once the new version is enabled, offer to `pause_flow_version` the old one, and do it only after the marketer agrees. To stop a live rule quickly, `pause_event_rule` and `resume_event_rule` exist; confirm with the marketer first.
