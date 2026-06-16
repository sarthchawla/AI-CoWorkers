import type { PlanningForm, SprintPlanningInput } from "./sprintPlanningTypes";

export function toNumber(value: string) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function roundVelocity(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculatePlanning(form: PlanningForm) {
  const averageNetVelocity = roundVelocity(
    (form.previousVelocityMinus3 + form.previousVelocityMinus2 + form.lastNetVelocity) / 3
  );
  const baselineCapacityDays = form.daysInSprintExcludingHolidays * form.teamMemberCount;
  const availableCapacityDays = Math.max(baselineCapacityDays - form.plannedLeaveDays, 0);
  const capacityRatio = baselineCapacityDays > 0 ? availableCapacityDays / baselineCapacityDays : 0;
  const capacityAdjustedVelocity = roundVelocity(averageNetVelocity * capacityRatio);
  const confidenceAdjustedVelocity = roundVelocity(
    capacityAdjustedVelocity * (1 + form.confidenceAdjustment / 100)
  );
  const override = form.manualVelocityOverride.trim() === "" ? null : toNumber(form.manualVelocityOverride);

  return {
    averageNetVelocity,
    baselineCapacityDays,
    availableCapacityDays,
    capacityAdjustedVelocity,
    confidenceAdjustedVelocity,
    sprintVelocity: roundVelocity(override ?? confidenceAdjustedVelocity),
    velocitySource: override == null ? "System suggestion" : "Team override"
  };
}

export function toSprintPlanningInput(form: PlanningForm): SprintPlanningInput {
  return {
    teamName: form.teamName,
    jiraProjectKey: form.jiraProjectKey,
    jiraBoardName: form.jiraBoardName,
    slackChannel: form.slackChannel,
    previousSprintName: form.previousSprintName,
    currentSprintName: form.currentSprintName,
    previousSprintDates: {
      start: form.previousSprintStart,
      end: form.previousSprintEnd
    },
    currentSprintDates: {
      start: form.currentSprintStart,
      end: form.currentSprintEnd
    },
    daysInSprintExcludingHolidays: form.daysInSprintExcludingHolidays,
    holidayCount: form.holidayCount,
    teamMemberCount: form.teamMemberCount,
    previousVelocityMinus3: form.previousVelocityMinus3,
    previousVelocityMinus2: form.previousVelocityMinus2,
    lastNetVelocity: form.lastNetVelocity,
    plannedLeaveDays: form.plannedLeaveDays,
    confidenceAdjustment: form.confidenceAdjustment,
    manualVelocityOverride:
      form.manualVelocityOverride.trim() === "" ? null : toNumber(form.manualVelocityOverride)
  };
}
