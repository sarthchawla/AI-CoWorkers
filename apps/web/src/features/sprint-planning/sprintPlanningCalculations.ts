import type { PlanningForm, SprintPlanningInput } from "./sprintPlanningTypes";

export function toNumber(value: string) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function roundVelocity(value: number) {
  return Math.round(value * 10) / 10;
}

function perDeveloperVelocity(value: number, teamMemberCount: number) {
  return teamMemberCount > 0 ? roundVelocity(value / teamMemberCount) : 0;
}

function getManualVelocityOverride(form: PlanningForm) {
  if (form.manualVelocityPerDeveloperOverride.trim() === "") {
    return {
      perDeveloper: null,
      total: null
    };
  }

  const perDeveloper = toNumber(form.manualVelocityPerDeveloperOverride);

  return {
    perDeveloper,
    total: roundVelocity(perDeveloper * form.teamMemberCount)
  };
}

export function calculatePlanning(form: PlanningForm) {
  const averageNetVelocity = roundVelocity(
    (form.previousVelocityMinus3 + form.previousVelocityMinus2 + form.lastNetVelocity) / 3
  );
  const baselineCapacityDays = form.daysInSprintExcludingHolidays * form.teamMemberCount;
  const availableCapacityDays = Math.max(baselineCapacityDays - form.upcomingSprintLeaveDays, 0);
  const capacityRatio = baselineCapacityDays > 0 ? availableCapacityDays / baselineCapacityDays : 0;
  const capacityAdjustedVelocity = roundVelocity(averageNetVelocity * capacityRatio);
  const confidenceAdjustedVelocity = roundVelocity(
    capacityAdjustedVelocity * (1 + form.confidenceAdjustment / 100)
  );
  const override = getManualVelocityOverride(form);

  return {
    averageNetVelocity,
    averageNetVelocityPerDeveloper: perDeveloperVelocity(averageNetVelocity, form.teamMemberCount),
    baselineCapacityDays,
    availableCapacityDays,
    capacityAdjustedVelocity,
    capacityAdjustedVelocityPerDeveloper: perDeveloperVelocity(capacityAdjustedVelocity, form.teamMemberCount),
    confidenceAdjustedVelocity,
    confidenceAdjustedVelocityPerDeveloper: perDeveloperVelocity(confidenceAdjustedVelocity, form.teamMemberCount),
    manualVelocityOverrideTotal: override.total,
    manualVelocityPerDeveloperOverride: override.perDeveloper,
    sprintVelocity: roundVelocity(override.total ?? confidenceAdjustedVelocity),
    sprintNetVelocityPerDeveloper: perDeveloperVelocity(
      roundVelocity(override.total ?? confidenceAdjustedVelocity),
      form.teamMemberCount
    ),
    velocitySource: override.total == null ? "System suggestion" : "Team override"
  };
}

export function toSprintPlanningInput(form: PlanningForm): SprintPlanningInput {
  const override = getManualVelocityOverride(form);

  return {
    teamKey: form.teamKey,
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
    previousSprintLeaveDays: form.previousSprintLeaveDays,
    upcomingSprintLeaveDays: form.upcomingSprintLeaveDays,
    confidenceAdjustment: form.confidenceAdjustment,
    manualVelocityOverride: override.total,
    velocityOverrideReason: form.velocityOverrideReason
  };
}
