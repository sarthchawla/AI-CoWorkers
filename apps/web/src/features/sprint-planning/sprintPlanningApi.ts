import type {
  DraftResponse,
  JiraReportingImportResponse,
  LeaveConfirmationRow,
  PlanningStatus,
  ScrumMasterStatusResponse,
  SavedSprintPlanningSessionResponse,
  SavedSprintPlanningSessionsResponse,
  SlackLeaveConfirmationImportResponse,
  SprintPlanningConnectorActionKey,
  SprintPlanningConnectorActionResponse,
  SprintPlanningInput,
  TeamConfigResponse,
  TeamSprintPlanningConfig,
  VelocityHistoryRow
} from "./sprintPlanningTypes";

export async function getScrumMasterStatus() {
  const response = await fetch("/api/coworkers/scrum-master");
  const payload = (await response.json()) as ScrumMasterStatusResponse;

  if (!response.ok) {
    throw new Error("Scrum Master status load failed");
  }

  return payload;
}

export async function getSprintPlanningTeamConfig(teamKey: string) {
  const response = await fetch(`/api/coworkers/scrum-master/sprint-planning/team-config/${teamKey}`);
  const payload = (await response.json()) as TeamConfigResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Team config load failed");
  }

  return payload;
}

export async function saveSprintPlanningTeamConfig(input: TeamSprintPlanningConfig) {
  const response = await fetch(
    `/api/coworkers/scrum-master/sprint-planning/team-config/${encodeURIComponent(input.teamKey)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    }
  );
  const payload = (await response.json()) as TeamConfigResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Team config save failed");
  }

  return payload;
}

export async function createSprintPlanningWorkflowDraft(input: SprintPlanningInput) {
  const response = await fetch("/api/coworkers/scrum-master/sprint-planning/workflow-draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = (await response.json()) as DraftResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Sprint planning draft failed");
  }

  return payload;
}

export async function getJiraVelocityHistory(input: {
  teamKey: string;
  jiraProjectKey: string;
  jiraBoardName: string;
  previousSprintName: string;
}) {
  const response = await fetch("/api/coworkers/scrum-master/sprint-planning/jira-reporting/import-preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      teamKey: input.teamKey,
      jiraProjectKey: input.jiraProjectKey,
      jiraBoardName: input.jiraBoardName,
      previousSprintName: input.previousSprintName,
      sprintCount: 3
    })
  });
  const payload = (await response.json()) as JiraReportingImportResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Jira velocity history import failed");
  }

  return payload;
}

export async function getSlackLeaveConfirmations(input: {
  teamKey: string;
  slackChannel: string;
  previousSprintName: string;
  currentSprintName: string;
}) {
  const response = await fetch("/api/coworkers/scrum-master/sprint-planning/slack/leave-confirmations/import-preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = (await response.json()) as SlackLeaveConfirmationImportResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Slack leave confirmation import failed");
  }

  return payload;
}

export async function listSprintPlanningSessions(teamKey: string) {
  const response = await fetch(
    `/api/coworkers/scrum-master/sprint-planning/sessions?teamKey=${encodeURIComponent(teamKey)}`
  );
  const payload = (await response.json()) as SavedSprintPlanningSessionsResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Saved sprint planning sessions load failed");
  }

  return payload;
}

export async function getSprintPlanningSession(sessionId: string) {
  const response = await fetch(`/api/coworkers/scrum-master/sprint-planning/sessions/${sessionId}`);
  const payload = (await response.json()) as SavedSprintPlanningSessionResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Saved sprint planning session load failed");
  }

  return payload;
}

export async function saveSprintPlanningSession(input: {
  sessionId?: string;
  planningStatus: PlanningStatus;
  planningInput: SprintPlanningInput;
  velocityHistory: VelocityHistoryRow[];
  leaveConfirmations: LeaveConfirmationRow[];
}) {
  const response = await fetch("/api/coworkers/scrum-master/sprint-planning/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId: input.sessionId,
      planningStatus: input.planningStatus,
      input: input.planningInput,
      velocityHistory: input.velocityHistory,
      leaveConfirmations: input.leaveConfirmations
    })
  });
  const payload = (await response.json()) as SavedSprintPlanningSessionResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Saved sprint planning session save failed");
  }

  return payload;
}

export async function cloneSprintPlanningSession(sessionId: string) {
  const response = await fetch(`/api/coworkers/scrum-master/sprint-planning/sessions/${sessionId}/clone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  const payload = (await response.json()) as SavedSprintPlanningSessionResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Saved sprint planning session clone failed");
  }

  return payload;
}

export async function runSprintPlanningConnectorAction(
  sessionId: string,
  actionKey: SprintPlanningConnectorActionKey
) {
  const response = await fetch(
    `/api/coworkers/scrum-master/sprint-planning/sessions/${sessionId}/connector-actions/${actionKey}/run`,
    {
      method: "POST"
    }
  );
  const payload = (await response.json()) as SprintPlanningConnectorActionResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Saved session connector action failed");
  }

  return payload;
}

export const createSprintPlanningDraft = createSprintPlanningWorkflowDraft;
