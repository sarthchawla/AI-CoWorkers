import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

const ceremonySchema = z.enum([
  "grooming",
  "planning",
  "standup",
  "mid-sprint-adjustment",
  "goal-tracking",
  "retro"
]);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    coworker: "jira-scrum-master"
  });
});

app.get("/api/coworkers/scrum-master", (_request, response) => {
  response.json({
    id: "jira-scrum-master",
    name: "Jira Scrum Master",
    focus: "Sprint grooming, planning, adjustments, standups, retros, and sprint goal tracking.",
    ceremonies: ceremonySchema.options
  });
});

app.post("/api/coworkers/scrum-master/ceremonies/:ceremony/run", (request, response) => {
  const ceremony = ceremonySchema.safeParse(request.params.ceremony);

  if (!ceremony.success) {
    response.status(400).json({
      error: "Unsupported ceremony",
      supportedCeremonies: ceremonySchema.options
    });
    return;
  }

  response.status(202).json({
    status: "queued",
    ceremony: ceremony.data,
    jiraProjectKey: request.body?.jiraProjectKey ?? null,
    next: "Connect Jira auth and board configuration before running live analysis."
  });
});

app.listen(port, () => {
  console.log(`AI CoWorkers API listening on http://localhost:${port}`);
});

