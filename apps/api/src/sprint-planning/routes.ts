import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import {
  jiraReportingImportSchema,
  sprintPlanningSchema,
  sprintPlanningSessionCloneSchema,
  sprintPlanningSessionSaveSchema,
  teamSprintPlanningConfigSchema
} from "./schema.js";
import {
  cloneSprintPlanningSession,
  getSprintPlanningSession,
  listSprintPlanningSessions,
  runSprintPlanningConnectorAction,
  saveSprintPlanningSession
} from "./sessionRepository.js";
import {
  calculateSprintPlanning,
  createJiraReportingImportPreview
} from "./service.js";
import { getTeamSprintPlanningConfig, saveTeamSprintPlanningConfig } from "./teamConfigRepository.js";

export const sprintPlanningRouter = Router();

sprintPlanningRouter.get("/team-config/:teamKey", async (request, response, next) => {
  try {
    response.json({
      status: "success",
      data: await getTeamSprintPlanningConfig(request.params.teamKey)
    });
  } catch (error) {
    next(error);
  }
});

async function saveTeamConfig(request: Request, response: Response, next: NextFunction) {
  const body = request.params.teamKey ? { ...request.body, teamKey: request.params.teamKey } : request.body;
  const parsedInput = teamSprintPlanningConfigSchema.safeParse(body);

  if (!parsedInput.success) {
    response.status(400).json({
      status: "error",
      message: "Invalid team sprint-planning config input",
      errors: parsedInput.error.flatten()
    });
    return;
  }

  try {
    response.json({
      status: "success",
      data: await saveTeamSprintPlanningConfig(parsedInput.data)
    });
  } catch (error) {
    next(error);
  }
}

sprintPlanningRouter.post("/team-config", saveTeamConfig);
sprintPlanningRouter.put("/team-config/:teamKey", saveTeamConfig);

sprintPlanningRouter.get("/sessions", async (request, response, next) => {
  try {
    response.json({
      status: "success",
      data: await listSprintPlanningSessions(
        typeof request.query.teamKey === "string" ? request.query.teamKey : undefined
      )
    });
  } catch (error) {
    next(error);
  }
});

sprintPlanningRouter.get("/sessions/:sessionId", async (request, response, next) => {
  try {
    const session = await getSprintPlanningSession(request.params.sessionId);

    if (!session) {
      response.status(404).json({
        status: "error",
        message: "Sprint planning session not found"
      });
      return;
    }

    response.json({
      status: "success",
      data: session
    });
  } catch (error) {
    next(error);
  }
});

sprintPlanningRouter.post("/sessions", async (request, response, next) => {
  const parsedInput = sprintPlanningSessionSaveSchema.safeParse(request.body);

  if (!parsedInput.success) {
    response.status(400).json({
      status: "error",
      message: "Invalid sprint planning session input",
      errors: parsedInput.error.flatten()
    });
    return;
  }

  try {
    response.json({
      status: "success",
      data: await saveSprintPlanningSession(parsedInput.data)
    });
  } catch (error) {
    next(error);
  }
});

sprintPlanningRouter.post("/sessions/:sessionId/clone", async (request, response, next) => {
  const parsedInput = sprintPlanningSessionCloneSchema.safeParse(request.body ?? {});

  if (!parsedInput.success) {
    response.status(400).json({
      status: "error",
      message: "Invalid sprint planning clone input",
      errors: parsedInput.error.flatten()
    });
    return;
  }

  try {
    const session = await cloneSprintPlanningSession(request.params.sessionId, parsedInput.data);

    if (!session) {
      response.status(404).json({
        status: "error",
        message: "Sprint planning session not found for clone"
      });
      return;
    }

    response.json({
      status: "success",
      data: session
    });
  } catch (error) {
    next(error);
  }
});

sprintPlanningRouter.post(
  "/sessions/:sessionId/connector-actions/:actionKey/run",
  async (request: Request, response: Response, next: NextFunction) => {
    const sessionId = String(request.params.sessionId);
    const actionKey = request.params.actionKey;

    if (actionKey !== "fetch-closed-story-points") {
      response.status(400).json({
        status: "error",
        message: "Unsupported sprint planning connector action",
        supportedActions: ["fetch-closed-story-points"]
      });
      return;
    }

    try {
      const result = await runSprintPlanningConnectorAction(sessionId, actionKey);

      if (!result) {
        response.status(404).json({
          status: "error",
          message: "Sprint planning session not found for connector action"
        });
        return;
      }

      response.json({
        status: "success",
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

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
