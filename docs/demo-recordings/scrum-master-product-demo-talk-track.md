# AI Scrum Master Product Demo Talk Track

## Demo Goal

Show how the AI Scrum Master coworker turns the current manual Excel, Jira, and Slack sprint-planning process into a guided workflow while keeping every automated value editable.

## 60-Second Narrative

1. Open the Scrum Master coworker on the sprint plan list.
2. Show that saved sprint plans can be continued, reviewed, or cloned into the next sprint.
3. Start a new sprint plan and confirm team setup:
   - team/project name
   - Jira project and board
   - Slack channel
   - sprint naming pattern
4. Clone the previous sprint context instead of copying an Excel sheet.
5. Review calendar fields:
   - sprint names
   - dates
   - working days
   - holiday count
   - team size
6. Review the net velocity baseline from the last three sprints.
7. Edit the manual leave request and show that teammate leave rows remain editable.
8. Save the session before running mock connector actions.
9. Run mock Jira close and mock Jira story-point reporting.
10. Set average net velocity per developer instead of overriding total velocity.
11. Show the derived total sprint net velocity calculation.
12. Finalize and save the sprint plan.
13. Return to the sprint list to show that planning can be resumed or reviewed later.

## Manager Takeaway

The first product slice uses deterministic automation for workflow, connector steps, persistence, and velocity math. AI should be added where it gives real leverage: summarizing Jira spillover, interpreting messy Slack replies, explaining velocity changes, detecting sprint risks, and drafting stakeholder updates.

## Current Demo Scope

- Jira and Slack are mocked.
- Connector actions update the saved local sprint-planning session only.
- The workflow is designed so a real read-only Jira adapter can replace mock Jira reporting later. Slack remains manual until we explicitly choose to add a connector.
- Scrum Master retains final authority because all imported and calculated values are editable.
