# Sprint Planning Automation Decision Notes

This document tracks which Scrum Master sprint-planning capabilities can be automated deterministically and which ones benefit from AI reasoning.

## Automate Without AI

These items should be implemented as normal product workflows, connector actions, calculations, or scheduled jobs.

| Capability | Why deterministic automation is enough | Candidate priority |
| --- | --- | --- |
| Clone previous sprint plan/session into next sprint | Uses saved session data and predictable field carry-forward rules. | High |
| Increment sprint name using configured pattern | Pattern-based string formatting. | High |
| Carry sprint dates forward by cadence | Date arithmetic based on sprint duration. | High |
| Calculate working days excluding weekends and configured holidays | Calendar calculation with configured holiday source. | High |
| Import Jira velocity history | Connector/API retrieval and mapping. | High |
| Pull net velocity from Jira reports | Connector/API retrieval and mapping from completed story points, leave, and closed-sprint context. | High |
| Close previous Jira sprint | Connector/API action with confirmation and audit trail. | Medium |
| Import Slack leave confirmations from structured replies/forms | Reliable when Slack input is structured. | Medium |
| Sum leave days and recalculate capacity | Numeric aggregation. | High |
| Calculate average net velocity | Numeric formula from prior sprint rows. | High |
| Calculate capacity-adjusted velocity | Numeric formula from capacity and leave data. | High |
| Save, resume, and finalize sprint plans | CRUD workflow state. | High |
| Track planning status and connector step completion | State machine / checklist logic. | High |
| Generate fixed Slack/Jira preview messages from templates | Template rendering from known fields. | Medium |

## Benefits From AI

These items need interpretation, summarization, judgment, ambiguity handling, or recommendation quality.

| Capability | Why AI helps | Candidate priority |
| --- | --- | --- |
| Interpret messy Slack leave replies | Handles informal text like "half day next Wed" or corrections buried in threads. | Medium |
| Summarize spillover context from Jira tickets | Reads issue comments, statuses, blockers, and carryover patterns. | High |
| Explain why velocity should be overridden | Turns team context into a clear planning rationale. | High |
| Detect sprint-risk patterns | Combines blockers, issue mix, dependencies, and capacity signals. | High |
| Suggest realistic sprint goals from selected Jira issues | Synthesizes ticket themes into a clear sprint goal. | High |
| Spot overloaded developers | Combines assignment load, leave, dependencies, and ticket complexity. | Medium |
| Draft planning notes, standup prompts, retro themes, and milestone summaries | Produces useful human-facing communication. | Medium |
| Recommend mid-sprint adjustments | Reasons about scope changes, blockers, and remaining capacity. | High |
| Detect stale tickets or unclear acceptance criteria | Reviews ticket text and activity quality. | Medium |
| Produce stakeholder-ready summaries from Jira and Slack activity | Summarizes operational activity into concise updates. | Medium |

## Recommended Product Split

The workflow engine should be deterministic:

- Connector actions retrieve and write data.
- Calculations stay formula-based and auditable.
- Every imported or calculated value remains editable.
- Saved sessions preserve auditability and allow users to resume planning.

AI should be layered on top as the Scrum Master reasoning assistant:

- Explain changes.
- Summarize context.
- Recommend adjustments.
- Detect risks.
- Draft communication.

This keeps the system trustworthy while still using AI where it provides real leverage.
