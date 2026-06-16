import type { DraftResponse, SprintPlanningInput } from "./sprintPlanningTypes";

export async function createSprintPlanningDraft(input: SprintPlanningInput) {
  const response = await fetch("/api/coworkers/scrum-master/sprint-planning/draft", {
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

