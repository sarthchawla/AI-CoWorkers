# Sprint Planning Persistence Model

This schema is the first Postgres design for turning the current in-memory Sprint Planning workbench into a durable workflow.

It covers:

- Team-level Jira and Slack configuration.
- Sprint planning sessions cloned from a previous sprint.
- Velocity history for `-3`, `-2`, and `-1` sprints.
- Leave confirmations collected through Slack or edited by the SM.
- Jira report snapshots for closed story points and sprint closure.
- Final velocity calculations and workflow checklist state.

The app does not connect to a database yet. This is the target schema for the next backend milestone.

