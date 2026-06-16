export type ConnectorStatus = "not-configured" | "available";

export interface JiraSprintConnector {
  closeSprint(input: { boardName: string; sprintName: string }): Promise<void>;
  getClosedStoryPoints(input: { projectKey: string; boardName: string; sprintName: string }): Promise<number>;
}

export interface SlackConnector {
  requestLeaveConfirmation(input: { channel: string; sprintName: string }): Promise<void>;
}

