import type { JiraReportingImportInput, SprintPlanningInput } from "./schema.js";

const teamSprintPlanningConfigs = {
  pta: {
    teamKey: "pta",
    teamName: "PTA",
    jira: {
      projectKey: "PTATPA",
      boardName: "PTA Sprint Board"
    },
    slack: {
      channelName: "#pta-sprint-planning"
    },
    defaults: {
      teamMemberCount: 5,
      daysInSprintExcludingHolidays: 10
    }
  }
};

const mockJiraVelocityHistory = [
  {
    sprintOffset: -3,
    sprintName: "Q2S4 - 2026",
    startDate: "2026-05-05",
    endDate: "2026-05-16",
    completedStoryPoints: 82,
    leaveDays: 1,
    netVelocity: 82,
    source: "mock-jira-report"
  },
  {
    sprintOffset: -2,
    sprintName: "Q2S5 - 2026",
    startDate: "2026-05-19",
    endDate: "2026-05-30",
    completedStoryPoints: 88,
    leaveDays: 2,
    netVelocity: 88,
    source: "mock-jira-report"
  },
  {
    sprintOffset: -1,
    sprintName: "Q2S6 - 2026",
    startDate: "2026-06-01",
    endDate: "2026-06-12",
    completedStoryPoints: 84,
    leaveDays: 2,
    netVelocity: 84,
    source: "mock-jira-report"
  }
];

const mockJiraSprintIds: Record<string, string> = {
  "Q2S4 - 2026": "jira-sprint-204",
  "Q2S5 - 2026": "jira-sprint-205",
  "Q2S6 - 2026": "jira-sprint-206"
};

function withJiraSprintId(row: (typeof mockJiraVelocityHistory)[number]) {
  return {
    ...row,
    jiraSprintId: mockJiraSprintIds[row.sprintName] ?? `mock-${row.sprintName.toLowerCase().replaceAll(" ", "-")}`,
    includeInAverage: true
  };
}

export function createJiraReportingImportPreview(input: JiraReportingImportInput) {
  const velocityHistory = mockJiraVelocityHistory.map(withJiraSprintId);
  const lastClosedSprint = velocityHistory.find((row) => row.sprintOffset === -1) ?? velocityHistory[2];

  return {
    projectKey: input.jiraProjectKey,
    boardName: input.jiraBoardName,
    importedAt: new Date().toISOString(),
    velocityHistory,
    previousSprintClosedStoryPoints: {
      sprintName: lastClosedSprint.sprintName,
      jiraSprintId: lastClosedSprint.jiraSprintId,
      completedStoryPoints: lastClosedSprint.completedStoryPoints,
      source: "mock-jira-report"
    },
    formPatch: {
      previousVelocityMinus3: velocityHistory.find((row) => row.sprintOffset === -3)?.netVelocity ?? 0,
      previousVelocityMinus2: velocityHistory.find((row) => row.sprintOffset === -2)?.netVelocity ?? 0,
      lastNetVelocity: lastClosedSprint.netVelocity
    },
    warnings: [
      "Using mock Jira reporting data until Jira API or MCP connector is configured.",
      `Previous sprint requested: ${input.previousSprintName}`
    ]
  };
}

function roundVelocity(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateSprintPlanning(input: SprintPlanningInput) {
  const averageNetVelocity = roundVelocity(
    (input.previousVelocityMinus3 + input.previousVelocityMinus2 + input.lastNetVelocity) / 3
  );
  const baselineCapacityDays = input.daysInSprintExcludingHolidays * input.teamMemberCount;
  const availableCapacityDays = Math.max(baselineCapacityDays - input.upcomingSprintLeaveDays, 0);
  const capacityRatio = baselineCapacityDays > 0 ? availableCapacityDays / baselineCapacityDays : 0;
  const capacityAdjustedVelocity = roundVelocity(averageNetVelocity * capacityRatio);
  const confidenceAdjustedVelocity = roundVelocity(
    capacityAdjustedVelocity * (1 + input.confidenceAdjustment / 100)
  );
  const sprintVelocity = roundVelocity(input.manualVelocityOverride ?? confidenceAdjustedVelocity);
  const velocitySource = input.manualVelocityOverride == null ? "system-suggested" : "team-override";
  const slackLeaveRequestPreview = [
    `Hi team, please update leaves for ${input.previousSprintName} and ${input.currentSprintName}.`,
    `Current plan has ${input.previousSprintLeaveDays} previous sprint leave days and ${input.upcomingSprintLeaveDays} upcoming sprint leave days recorded.`,
    "Please reply with any corrections before sprint planning is finalized."
  ].join("\n");
  const jiraCloseReportPreview = {
    closeSprintAction: `Close ${input.previousSprintName} on ${input.jiraBoardName}`,
    reportingAction: `Fetch closed story points for ${input.previousSprintName} in ${input.jiraProjectKey}`,
    lastNetVelocity: input.lastNetVelocity
  };
  const sprintCloneSummary = {
    from: input.previousSprintName,
    to: input.currentSprintName,
    copiedFields: [
      "sprint dates",
      "days in sprint excluding holidays",
      "holiday count",
      "team Jira board",
      "team Slack channel"
    ]
  };

  return {
    averageNetVelocity,
    baselineCapacityDays,
    availableCapacityDays,
    capacityRatio: roundVelocity(capacityRatio),
    capacityAdjustedVelocity,
    confidenceAdjustedVelocity,
    sprintVelocity,
    velocitySource,
    velocityOverrideReason: input.manualVelocityOverride == null ? null : input.velocityOverrideReason?.trim() || null,
    sprintCloneSummary,
    slackLeaveRequestPreview,
    jiraCloseReportPreview,
    checklist: [
      {
        id: "clone-sprint-context",
        status: "ready",
        label: `Prepare ${input.currentSprintName} from ${input.previousSprintName}`
      },
      {
        id: "copy-calendar",
        status: "ready",
        label: `Carry ${input.daysInSprintExcludingHolidays} working days and ${input.holidayCount} holidays`
      },
      {
        id: "collect-leaves",
        status: "connector-pending",
        label: `Send leave confirmation request to ${input.slackChannel}`
      },
      {
        id: "close-previous-sprint",
        status: "connector-pending",
        label: `Close ${input.previousSprintName} on Jira board ${input.jiraBoardName}`
      },
      {
        id: "fetch-last-net-velocity",
        status: "connector-pending",
        label: `Use Jira reporting value ${input.lastNetVelocity} as last net velocity`
      },
      {
        id: "finalize-sprint-velocity",
        status: "ready",
        label: `Finalize sprint velocity at ${sprintVelocity} (${velocitySource})`
      }
    ],
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

export function getTeamSprintPlanningConfig(teamKey: string) {
  return teamSprintPlanningConfigs[teamKey as keyof typeof teamSprintPlanningConfigs] ?? teamSprintPlanningConfigs.pta;
}
