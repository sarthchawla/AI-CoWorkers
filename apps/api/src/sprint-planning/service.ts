import type { SprintPlanningInput } from "./schema.js";

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
