import { Router } from "express";
import type { Request, Response } from "express";
import { sprintPlanningSchema } from "./schema.js";
import { calculateSprintPlanning, getTeamSprintPlanningConfig } from "./service.js";

export const sprintPlanningRouter = Router();

sprintPlanningRouter.get("/team-config/:teamKey", (request, response) => {
  response.json({
    status: "success",
    data: getTeamSprintPlanningConfig(request.params.teamKey)
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
