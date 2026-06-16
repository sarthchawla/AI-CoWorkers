import { z } from "zod";

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

export const jiraReportingImportSchema = z.object({
  teamKey: z.string().optional(),
  jiraProjectKey: z.string().min(1),
  jiraBoardName: z.string().min(1),
  previousSprintName: z.string().min(1),
  currentSprintName: z.string().optional(),
  sprintCount: z.literal(3)
});

export type JiraReportingImportInput = z.infer<typeof jiraReportingImportSchema>;
