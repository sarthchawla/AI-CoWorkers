export type PlanningForm = {
  teamName: string;
  jiraProjectKey: string;
  jiraBoardName: string;
  slackChannel: string;
  previousSprintName: string;
  currentSprintName: string;
  previousSprintStart: string;
  previousSprintEnd: string;
  currentSprintStart: string;
  currentSprintEnd: string;
  daysInSprintExcludingHolidays: number;
  holidayCount: number;
  teamMemberCount: number;
  previousVelocityMinus3: number;
  previousVelocityMinus2: number;
  lastNetVelocity: number;
  plannedLeaveDays: number;
  confidenceAdjustment: number;
  manualVelocityOverride: string;
};

export type SprintPlanningInput = {
  teamName: string;
  jiraProjectKey: string;
  jiraBoardName: string;
  slackChannel: string;
  previousSprintName: string;
  currentSprintName: string;
  previousSprintDates: {
    start: string;
    end: string;
  };
  currentSprintDates: {
    start: string;
    end: string;
  };
  daysInSprintExcludingHolidays: number;
  holidayCount: number;
  teamMemberCount: number;
  previousVelocityMinus3: number;
  previousVelocityMinus2: number;
  lastNetVelocity: number;
  plannedLeaveDays: number;
  confidenceAdjustment: number;
  manualVelocityOverride: number | null;
};

export type AutomationStep = {
  id: string;
  label: string;
  owner: string;
  status: "ready" | "connector-pending" | "team-input" | "replaced-by-app";
};

export type DraftResponse = {
  status: string;
  data?: {
    output: {
      sprintVelocity: number;
      averageNetVelocity: number;
      baselineCapacityDays: number;
      capacityAdjustedVelocity: number;
      confidenceAdjustedVelocity: number;
      availableCapacityDays: number;
      velocitySource: string;
      automationPlan: Array<{
        id: string;
        status: string;
        label: string;
      }>;
    };
  };
};

export type PlanningResult = {
  averageNetVelocity: number;
  baselineCapacityDays: number;
  availableCapacityDays: number;
  capacityAdjustedVelocity: number;
  confidenceAdjustedVelocity: number;
  sprintVelocity: number;
  velocitySource: string;
};
