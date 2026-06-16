import { Router } from "express";
import type { Request, Response } from "express";
import { jiraReportingImportSchema, sprintPlanningSchema } from "./schema.js";
import { calculateSprintPlanning, createJiraReportingImportPreview, getTeamSprintPlanningConfig } from "./service.js";

export const sprintPlanningRouter = Router();

sprintPlanningRouter.get("/team-config/:teamKey", (request, response) => {
  response.json({
    status: "success",
    data: getTeamSprintPlanningConfig(request.params.teamKey)
  });
});

sprintPlanningRouter.post("/jira-reporting/import-preview", (request, response) => {
  const parsedInput = jiraReportingImportSchema.safeParse(request.body);

  if (!parsedInput.success) {
    response.status(400).json({
      status: "error",
      message: "Invalid Jira reporting import input",
      errors: parsedInput.error.flatten()
    });
    return;
  }

  response.json({
    status: "success",
    data: createJiraReportingImportPreview(parsedInput.data)
  });
});

function createWorkflowDraft(request: Request, response: Response) {
  const parsedInput = sprintPlanningSchema.safeParse(request.body);

  if (!parsedInput.success) {
    response.status(400).json({
      status: "error",
      message: "Invalid sprint planning input",
      errors: parsedInput.error.flatten()
    });
    return;
  }

  response.json({
    status: "success",
    data: {
      input: parsedInput.data,
      output: calculateSprintPlanning(parsedInput.data)
    }
  });
}

sprintPlanningRouter.post("/draft", createWorkflowDraft);
sprintPlanningRouter.post("/workflow-draft", createWorkflowDraft);
