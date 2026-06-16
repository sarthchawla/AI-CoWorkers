export type SprintPlanningConnectorMode = "mock";

export function getSprintPlanningConnectorMode(): SprintPlanningConnectorMode {
  return "mock";
}

export function getSprintPlanningConnectorModeLabel() {
  const configuredMode = process.env.SPRINT_PLANNING_CONNECTOR_MODE ?? "mock";

  return configuredMode === "mock"
    ? "mock"
    : `mock (configured ${configuredMode} is not implemented yet)`;
}
