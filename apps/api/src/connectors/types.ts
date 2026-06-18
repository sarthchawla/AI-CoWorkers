export type ConnectorStatus = "not-configured" | "available";

export interface JiraSprintConnector {
  getClosedStoryPoints(input: { projectKey: string; boardName: string; sprintName: string }): Promise<number>;
}
