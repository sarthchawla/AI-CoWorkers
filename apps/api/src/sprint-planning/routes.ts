import { Router } from "express";
import { sprintPlanningSchema } from "./schema.js";
import { calculateSprintPlanning } from "./service.js";

export const sprintPlanningRouter = Router();

sprintPlanningRouter.post("/draft", (request, response) => {
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
});
