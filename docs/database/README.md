# Sprint Planning Persistence Model

This schema is the first Postgres design for turning the current in-memory Sprint Planning workbench into a durable workflow.

It covers:

- Team-level Jira and Slack configuration.
- Sprint planning sessions cloned from a previous sprint.
- Velocity history for `-3`, `-2`, and `-1` sprints.
- Leave confirmations collected through Slack or edited by the SM.
- Jira report snapshots for closed story points and sprint closure.
- Final velocity calculations and workflow checklist state.

The current app uses `mock-jira-report` as the source for preview imports. Real Jira API or MCP imports should write `jira_report`.

The API currently saves development drafts to a local JSON file configured by `SPRINT_PLANNING_DATA_FILE`. This schema is the target Postgres shape for replacing that adapter with durable multi-user storage.
