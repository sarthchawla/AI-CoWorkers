import type { SprintPlanningInput } from "./schema.js";

function roundVelocity(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateSprintPlanning(input: SprintPlanningInput) {
  const averageNetVelocity = roundVelocity(
    (input.previousVelocityMinus3 + input.previousVelocityMinus2 + input.lastNetVelocity) / 3
  );
  const baselineCapacityDays = input.daysInSprintExcludingHolidays * input.teamMemberCount;
  const availableCapacityDays = Math.max(baselineCapacityDays - input.plannedLeaveDays, 0);
  const capacityRatio = baselineCapacityDays > 0 ? availableCapacityDays / baselineCapacityDays : 0;
  const capacityAdjustedVelocity = roundVelocity(averageNetVelocity * capacityRatio);
  const confidenceAdjustedVelocity = roundVelocity(
    capacityAdjustedVelocity * (1 + input.confidenceAdjustment / 100)
  );
  const sprintVelocity = roundVelocity(input.manualVelocityOverride ?? confidenceAdjustedVelocity);

  return {
    averageNetVelocity,
    baselineCapacityDays,
    availableCapacityDays,
    capacityRatio: roundVelocity(capacityRatio),
    capacityAdjustedVelocity,
    confidenceAdjustedVelocity,
    sprintVelocity,
    velocitySource: input.manualVelocityOverride == null ? "system-suggested" : "team-override",
    automationPlan: [
      {
        id: "clone-previous-sprint-sheet",
        status: "replaced-by-app",
        label: `Create ${input.currentSprintName} from ${input.previousSprintName} planning context`
      },
      {
        id: "collect-leaves",
        status: "connector-pending",
        label: `Ask ${input.slackChannel} to confirm previous and upcoming sprint leaves`
      },
      {
        id: "close-previous-sprint",
        status: "connector-pending",
        label: `Close previous sprint on Jira board ${input.jiraBoardName}`
      },
      {
        id: "fetch-closed-story-points",
        status: "connector-pending",
        label: `Fetch completed story points for ${input.previousSprintName} from Jira`
      },
      {
        id: "calculate-sprint-velocity",
        status: "ready",
        label: "Calculate average, capacity-adjusted, and final sprint velocity"
      }
    ]
  };
}
