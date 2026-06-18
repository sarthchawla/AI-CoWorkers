import type { JiraReportingImportInput, SprintPlanningInput, VelocityHistoryRowInput } from "./schema.js";
import {
  getSprintPlanningConnectorMode,
  getSprintPlanningConnectorModeLabel
} from "../connectors/connectorEnvironment.js";
import { readJiraVelocityHistory } from "../connectors/jiraClient.js";
import {
  mockJiraSprintIds,
  mockJiraVelocityHistory
} from "../connectors/mockSprintPlanningData.js";
import { getTeamSprintPlanningConfig } from "./teamConfigRepository.js";

function withJiraSprintId(row: (typeof mockJiraVelocityHistory)[number]) {
  return {
    ...row,
    jiraSprintId: mockJiraSprintIds[row.sprintName] ?? `mock-${row.sprintName.toLowerCase().replaceAll(" ", "-")}`,
    includeInAverage: true
  };
}

function createJiraReportingPreviewResponse(
  input: JiraReportingImportInput,
  velocityHistory: VelocityHistoryRowInput[],
  warnings: string[]
) {
  const lastClosedSprint = velocityHistory.find((row) => row.sprintOffset === -1) ?? velocityHistory.at(-1);

  if (!lastClosedSprint) {
    throw new Error("Jira reporting import did not return any velocity history rows");
  }

  return {
    projectKey: input.jiraProjectKey,
    boardName: input.jiraBoardName,
    importedAt: new Date().toISOString(),
    velocityHistory,
    previousSprintClosedStoryPoints: {
      sprintName: lastClosedSprint.sprintName,
      jiraSprintId: lastClosedSprint.jiraSprintId,
      completedStoryPoints: lastClosedSprint.completedStoryPoints,
      source: lastClosedSprint.source
    },
    formPatch: {
      previousVelocityMinus3: velocityHistory.find((row) => row.sprintOffset === -3)?.netVelocity ?? 0,
      previousVelocityMinus2: velocityHistory.find((row) => row.sprintOffset === -2)?.netVelocity ?? 0,
      lastNetVelocity: lastClosedSprint.netVelocity
    },
    warnings
  };
}

export async function createJiraReportingImportPreview(input: JiraReportingImportInput) {
  if (getSprintPlanningConnectorMode() === "jira") {
    const teamConfig = await getTeamSprintPlanningConfig(input.teamKey ?? "pta");
    const preview = await readJiraVelocityHistory({
      teamConfig,
      previousSprintName: input.previousSprintName,
      sprintCount: input.sprintCount
    });

    return createJiraReportingPreviewResponse(input, preview.velocityHistory, [
      "Using live Jira reporting data with read-only Jira API calls.",
      `Previous sprint requested: ${input.previousSprintName}`,
      ...preview.warnings
    ]);
  }

  return createJiraReportingPreviewResponse(input, mockJiraVelocityHistory.map(withJiraSprintId), [
    `Using ${getSprintPlanningConnectorModeLabel()} Jira reporting data until Jira connector mode is enabled.`,
    `Previous sprint requested: ${input.previousSprintName}`
  ]);
}

function roundVelocity(value: number) {
  return Math.round(value * 10) / 10;
}

function perDeveloperVelocity(value: number, teamMemberCount: number) {
  return teamMemberCount > 0 ? roundVelocity(value / teamMemberCount) : 0;
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
  const sprintNetVelocityPerDeveloper = perDeveloperVelocity(sprintVelocity, input.teamMemberCount);
  const velocitySource = input.manualVelocityOverride == null ? "system-suggested" : "team-override";
  const slackLeaveRequestPreview = [
    `Hi team, please update leaves for ${input.previousSprintName} and ${input.currentSprintName}.`,
    `Current plan has ${input.previousSprintLeaveDays} previous sprint leave days and ${input.upcomingSprintLeaveDays} upcoming sprint leave days recorded.`,
    "Please reply with any corrections before sprint planning is finalized."
  ].join("\n");
  const jiraCloseReportPreview = {
    closeSprintAction: `Manually close ${input.previousSprintName} on ${input.jiraBoardName}`,
    reportingAction: `Fetch net velocity per developer for ${input.previousSprintName} in ${input.jiraProjectKey}`,
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
    averageNetVelocityPerDeveloper: perDeveloperVelocity(averageNetVelocity, input.teamMemberCount),
    baselineCapacityDays,
    availableCapacityDays,
    capacityRatio: roundVelocity(capacityRatio),
    capacityAdjustedVelocity,
    capacityAdjustedVelocityPerDeveloper: perDeveloperVelocity(capacityAdjustedVelocity, input.teamMemberCount),
    confidenceAdjustedVelocity,
    confidenceAdjustedVelocityPerDeveloper: perDeveloperVelocity(confidenceAdjustedVelocity, input.teamMemberCount),
    sprintVelocity,
    sprintNetVelocityPerDeveloper,
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
        id: "manual-leave-updates",
        status: "team-input",
        label: `Manually collect leave updates using ${input.slackChannel}`
      },
      {
        id: "close-previous-sprint",
        status: "team-input",
        label: `Manually close ${input.previousSprintName} on Jira board ${input.jiraBoardName}`
      },
      {
        id: "fetch-last-net-velocity",
        status: "connector-pending",
        label: `Use Jira reporting value ${perDeveloperVelocity(input.lastNetVelocity, input.teamMemberCount)} as last net velocity/dev`
      },
      {
        id: "finalize-sprint-velocity",
        status: "ready",
        label: `Finalize sprint net velocity/dev at ${sprintNetVelocityPerDeveloper} (${sprintVelocity} total, ${velocitySource})`
      }
    ],
    automationPlan: [
      {
        id: "clone-previous-sprint-sheet",
        status: "replaced-by-app",
        label: `Create ${input.currentSprintName} from ${input.previousSprintName} planning context`
      },
      {
        id: "manual-leave-updates",
        status: "team-input",
        label: `Prepare a leave request for ${input.slackChannel} and update rows manually`
      },
      {
        id: "close-previous-sprint",
        status: "team-input",
        label: `Open Jira and manually close previous sprint on ${input.jiraBoardName}`
      },
      {
        id: "fetch-closed-story-points",
        status: "connector-pending",
        label: `Fetch net velocity per developer for ${input.previousSprintName} from Jira`
      },
      {
        id: "calculate-sprint-velocity",
        status: "ready",
        label: "Calculate average, capacity-adjusted, and final sprint net velocity per developer"
      }
    ]
  };
}
