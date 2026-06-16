import type { DraftResponse, SprintPlanningInput, TeamConfigResponse } from "./sprintPlanningTypes";

export async function getSprintPlanningTeamConfig(teamKey: string) {
  const response = await fetch(`/api/coworkers/scrum-master/sprint-planning/team-config/${teamKey}`);
  const payload = (await response.json()) as TeamConfigResponse;

  if (!response.ok) {
    throw new Error(payload.status || "Team config load failed");
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

export const createSprintPlanningDraft = createSprintPlanningWorkflowDraft;
