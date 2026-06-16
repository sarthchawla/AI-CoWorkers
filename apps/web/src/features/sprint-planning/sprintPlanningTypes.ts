export type PlanningForm = {
  teamKey: string;
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
  previousSprintLeaveDays: number;
  upcomingSprintLeaveDays: number;
  confidenceAdjustment: number;
  manualVelocityOverride: string;
  velocityOverrideReason: string;
};

export type SprintPlanningInput = {
  teamKey?: string;
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
  previousSprintLeaveDays: number;
  upcomingSprintLeaveDays: number;
  confidenceAdjustment: number;
  manualVelocityOverride: number | null;
  velocityOverrideReason: string;
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
      velocityOverrideReason: string | null;
      sprintCloneSummary: {
        from: string;
        to: string;
        copiedFields: string[];
      };
      slackLeaveRequestPreview: string;
      jiraCloseReportPreview: {
        closeSprintAction: string;
        reportingAction: string;
        lastNetVelocity: number;
      };
      checklist: Array<{
        id: string;
        status: string;
        label: string;
      }>;
      automationPlan: Array<{
        id: string;
        status: string;
        label: string;
      }>;
    };
  };
};

export type TeamSprintPlanningConfig = {
  teamKey: string;
  teamName: string;
  jira: {
    projectKey: string;
    boardName: string;
    boardId?: string;
  };
  slack: {
    channelName: string;
    channelId?: string;
  };
  defaults: {
    teamMemberCount: number;
    daysInSprintExcludingHolidays: number;
  };
};

export type TeamConfigResponse = {
  status: string;
  data: TeamSprintPlanningConfig;
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
