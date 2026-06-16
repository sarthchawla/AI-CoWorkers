import { z } from "zod";

export const teamSprintPlanningConfigSchema = z.object({
  teamKey: z.string().min(1),
  teamName: z.string().min(1),
  jira: z.object({
    projectKey: z.string().min(1),
    boardName: z.string().min(1),
    boardId: z.string().optional()
  }),
  slack: z.object({
    channelName: z.string().min(1),
    channelId: z.string().optional()
  }),
  defaults: z.object({
    teamMemberCount: z.number().positive(),
    daysInSprintExcludingHolidays: z.number().positive()
  })
});

export type TeamSprintPlanningConfigInput = z.infer<typeof teamSprintPlanningConfigSchema>;

export const sprintPlanningSchema = z.object({
  teamKey: z.string().optional(),
  teamName: z.string().min(1),
  jiraProjectKey: z.string().min(1),
  jiraBoardName: z.string().min(1),
  slackChannel: z.string().min(1),
  previousSprintName: z.string().min(1),
  currentSprintName: z.string().min(1),
  previousSprintDates: z.object({
    start: z.string().min(1),
    end: z.string().min(1)
  }),
  currentSprintDates: z.object({
    start: z.string().min(1),
    end: z.string().min(1)
  }),
  daysInSprintExcludingHolidays: z.number().positive(),
  holidayCount: z.number().min(0),
  teamMemberCount: z.number().positive(),
  previousVelocityMinus3: z.number().min(0),
  previousVelocityMinus2: z.number().min(0),
  lastNetVelocity: z.number().min(0),
  previousSprintLeaveDays: z.number().min(0),
  upcomingSprintLeaveDays: z.number().min(0),
  manualVelocityOverride: z.number().min(0).nullable().optional(),
  confidenceAdjustment: z.number().min(-50).max(50),
  velocityOverrideReason: z.string().optional()
});

export type SprintPlanningInput = z.infer<typeof sprintPlanningSchema>;

export const velocityHistoryRowSchema = z.object({
  sprintOffset: z.union([z.literal(-3), z.literal(-2), z.literal(-1)]),
  sprintName: z.string().min(1),
  jiraSprintId: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  completedStoryPoints: z.number().min(0),
  leaveDays: z.number().min(0),
  netVelocity: z.number().min(0),
  source: z.enum(["manual", "mock-jira-report", "jira_report"]),
  includeInAverage: z.boolean()
});

export type VelocityHistoryRowInput = z.infer<typeof velocityHistoryRowSchema>;

export const leaveConfirmationRowSchema = z.object({
  teammateName: z.string().min(1),
  slackUserId: z.string().min(1),
  previousSprintLeaveDays: z.number().min(0),
  upcomingSprintLeaveDays: z.number().min(0),
  confirmationStatus: z.enum(["pending", "confirmed", "updated_by_sm"]),
  source: z.enum(["manual", "mock-slack-thread", "slack_thread"])
});

export type LeaveConfirmationRowInput = z.infer<typeof leaveConfirmationRowSchema>;

export const sprintPlanningSessionSaveSchema = z.object({
  sessionId: z.string().optional(),
  planningStatus: z.enum(["draft", "ready_for_review", "finalized", "published"]).default("draft"),
  input: sprintPlanningSchema,
  velocityHistory: z.array(velocityHistoryRowSchema).min(1),
  leaveConfirmations: z.array(leaveConfirmationRowSchema)
});

export type SprintPlanningSessionSaveInput = z.infer<typeof sprintPlanningSessionSaveSchema>;

export const sprintPlanningSessionCloneSchema = z.object({
  currentSprintName: z.string().min(1).optional(),
  currentSprintDates: z
    .object({
      start: z.string().min(1),
      end: z.string().min(1)
    })
    .optional()
});

export type SprintPlanningSessionCloneInput = z.infer<typeof sprintPlanningSessionCloneSchema>;

export const jiraReportingImportSchema = z.object({
  teamKey: z.string().optional(),
  jiraProjectKey: z.string().min(1),
  jiraBoardName: z.string().min(1),
  previousSprintName: z.string().min(1),
  currentSprintName: z.string().optional(),
  sprintCount: z.literal(3)
});

export type JiraReportingImportInput = z.infer<typeof jiraReportingImportSchema>;

export const slackLeaveConfirmationImportSchema = z.object({
  teamKey: z.string().optional(),
  slackChannel: z.string().min(1),
  previousSprintName: z.string().min(1),
  currentSprintName: z.string().min(1)
});

export type SlackLeaveConfirmationImportInput = z.infer<typeof slackLeaveConfirmationImportSchema>;
