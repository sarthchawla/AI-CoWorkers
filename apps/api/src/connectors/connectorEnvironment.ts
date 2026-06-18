export type SprintPlanningConnectorMode = "mock" | "jira";

export function getSprintPlanningConnectorMode(): SprintPlanningConnectorMode {
  return process.env.SPRINT_PLANNING_CONNECTOR_MODE === "jira" ? "jira" : "mock";
}

export function getSprintPlanningConnectorModeLabel() {
  return getSprintPlanningConnectorMode();
}
