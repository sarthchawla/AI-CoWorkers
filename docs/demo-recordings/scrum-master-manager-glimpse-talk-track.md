# AI Scrum Master Manager Demo Talk Track

## Objective

Show a concise glimpse of the AI Scrum Master coworker: a guided sprint planning workflow that replaces spreadsheet copying and coordinates editable Jira reporting and manual leave planning steps.

## Demo Flow

1. Start from the sprint plan list where plans can be resumed or reviewed.
2. Start a new sprint plan with configurable team, Jira, manual leave channel, and sprint naming settings.
3. Clone previous sprint context and carry calendar details forward.
4. Edit the manual leave request draft for the configured channel.
5. Confirm manually updated leave rows without running any Slack connector.
6. Save an audit point before connector reads.
7. Keep Jira writes manual: the SM closes the sprint in Jira from the provided link.
8. Pull read-only Jira reporting for completed net velocity/dev.
9. Override net velocity/dev per developer with a clear rationale.
10. Save the plan and return to the sprint list.

## Future Plans

- Replace mock Jira reporting with a live read-only Jira adapter.
- Use AI to summarize messy leave context and unresolved replies.
- Add spillover and sprint-risk reasoning.
- Recommend sprint goals and track milestone health through the sprint.
