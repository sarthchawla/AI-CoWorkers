export type PlanningForm = {
  teamKey: string;
  teamName: string;
  jiraProjectName: string;
  jiraProjectKey: string;
  jiraBoardName: string;
  slackChannel: string;
  sprintNamingPattern: string;
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
  manualVelocityPerDeveloperOverride: string;
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
  status: "ready" | "connector-pending" | "team-input" | "replaced-by-app" | "done";
};

export type DraftResponse = {
  status: string;
  data?: {
    output: {
      sprintVelocity: number;
      sprintNetVelocityPerDeveloper?: number;
      averageNetVelocity: number;
      averageNetVelocityPerDeveloper?: number;
      baselineCapacityDays: number;
      capacityAdjustedVelocity: number;
      capacityAdjustedVelocityPerDeveloper?: number;
      confidenceAdjustedVelocity: number;
      confidenceAdjustedVelocityPerDeveloper?: number;
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
    projectName?: string;
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
    sprintNamingPattern?: string;
  };
};

export type TeamConfigResponse = {
  status: string;
  data: TeamSprintPlanningConfig;
};

export type VelocityHistoryRow = {
  sprintOffset: -3 | -2 | -1;
  sprintName: string;
  jiraSprintId?: string;
  startDate: string;
  endDate: string;
  completedStoryPoints: number;
  leaveDays: number;
  netVelocity: number;
  source: "manual" | "mock-jira-report" | "jira_report";
  includeInAverage: boolean;
};

export type JiraReportingImportResponse = {
  status: string;
  data: {
    projectKey: string;
    boardName: string;
    importedAt: string;
    velocityHistory: VelocityHistoryRow[];
    previousSprintClosedStoryPoints: {
      sprintName: string;
      jiraSprintId: string;
      completedStoryPoints: number;
      source: "mock-jira-report";
    };
    formPatch: {
      previousVelocityMinus3: number;
      previousVelocityMinus2: number;
      lastNetVelocity: number;
    };
    warnings: string[];
  };
};

export type LeaveConfirmationRow = {
  teammateName: string;
  slackUserId: string;
  previousSprintLeaveDays: number;
  upcomingSprintLeaveDays: number;
  confirmationStatus: "pending" | "confirmed" | "updated_by_sm";
  source: "manual" | "mock-slack-thread" | "slack_thread";
};

export type SlackLeaveConfirmationImportResponse = {
  status: string;
  data: {
    channelName: string;
    importedAt: string;
    requestPreview: string;
    confirmations: LeaveConfirmationRow[];
    formPatch: {
      previousSprintLeaveDays: number;
      upcomingSprintLeaveDays: number;
    };
    warnings: string[];
  };
};

export type PlanningResult = {
  averageNetVelocity: number;
  averageNetVelocityPerDeveloper: number;
  baselineCapacityDays: number;
  availableCapacityDays: number;
  capacityAdjustedVelocity: number;
  capacityAdjustedVelocityPerDeveloper: number;
  confidenceAdjustedVelocity: number;
  confidenceAdjustedVelocityPerDeveloper: number;
  manualVelocityOverrideTotal: number | null;
  manualVelocityPerDeveloperOverride: number | null;
  sprintVelocity: number;
  sprintNetVelocityPerDeveloper: number;
  velocitySource: string;
};

export type PlanningStatus = "draft" | "ready_for_review" | "finalized" | "published";

export type WorkflowStepId =
  | "clone"
  | "calendar"
  | "slack-leaves"
  | "jira-close"
  | "jira-reporting"
  | "velocity-decision"
  | "finalize";

export type WorkflowStepState = "current" | "completed" | "available" | "locked";

export type SprintPlanningConnectorActionKey =
  | "collect-leaves"
  | "fetch-closed-story-points";

export type SprintPlanningConnectorActionResult = {
  actionKey: SprintPlanningConnectorActionKey;
  connector: "jira" | "slack";
  mode: "mock";
  status: "done";
  ranAt: string;
  output: Record<string, unknown>;
  warnings: string[];
};

export type SavedSprintPlanningSessionSummary = {
  sessionId: string;
  teamKey?: string;
  teamName: string;
  currentSprintName: string;
  previousSprintName: string;
  currentSprintDates: {
    start: string;
    end: string;
  };
  planningStatus: PlanningStatus;
  sprintVelocity: number;
  sprintVelocityPerDeveloper: number;
  teamMemberCount: number;
  pendingLeaveConfirmations: number;
  connectorPendingSteps: number;
  updatedAt: string;
};

export type SavedSprintPlanningSession = {
  sessionId: string;
  planningStatus: PlanningStatus;
  input: SprintPlanningInput;
  velocityHistory: VelocityHistoryRow[];
  leaveConfirmations: LeaveConfirmationRow[];
  connectorActions: SprintPlanningConnectorActionResult[];
  output: NonNullable<DraftResponse["data"]>["output"];
  createdAt: string;
  updatedAt: string;
};

export type SavedSprintPlanningSessionsResponse = {
  status: string;
  data: SavedSprintPlanningSessionSummary[];
};

export type SavedSprintPlanningSessionResponse = {
  status: string;
  data: SavedSprintPlanningSession;
};

export type SprintPlanningConnectorActionResponse = {
  status: string;
  data: {
    session: SavedSprintPlanningSession;
    action: SprintPlanningConnectorActionResult;
  };
};

export type ScrumMasterStatusResponse = {
  id: string;
  name: string;
  focus: string;
  sprintPlanningConnectorMode: string;
  ceremonies: string[];
};
