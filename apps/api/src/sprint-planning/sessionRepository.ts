import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SprintPlanningSessionSaveInput } from "./schema.js";
import { calculateSprintPlanning } from "./service.js";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../../..");
const defaultStorePath = path.join(repoRoot, "data", "sprint-planning-sessions.json");
const storePath = process.env.SPRINT_PLANNING_DATA_FILE ?? defaultStorePath;

export type SprintPlanningSession = SprintPlanningSessionSaveInput & {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
};

type SprintPlanningSessionStore = {
  sessions: SprintPlanningSession[];
};

async function readStore(): Promise<SprintPlanningSessionStore> {
  try {
    const content = await readFile(storePath, "utf8");
    return JSON.parse(content) as SprintPlanningSessionStore;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { sessions: [] };
    }

    throw error;
  }
}

async function writeStore(store: SprintPlanningSessionStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

function createSessionId(input: SprintPlanningSessionSaveInput) {
  const team = input.input.teamKey ?? input.input.teamName;
  const sprint = input.input.currentSprintName;
  const slug = `${team}-${sprint}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "sprint-planning"}-${Date.now().toString(36)}`;
}

export function serializeSprintPlanningSession(session: SprintPlanningSession) {
  return {
    ...session,
    output: calculateSprintPlanning(session.input)
  };
}

export async function listSprintPlanningSessions(teamKey?: string) {
  const store = await readStore();
  const sessions = teamKey
    ? store.sessions.filter((session) => session.input.teamKey === teamKey)
    : store.sessions;

  return sessions
    .map((session) => ({
      sessionId: session.sessionId,
      teamKey: session.input.teamKey,
      teamName: session.input.teamName,
      currentSprintName: session.input.currentSprintName,
      previousSprintName: session.input.previousSprintName,
      currentSprintDates: session.input.currentSprintDates,
      planningStatus: session.planningStatus,
      sprintVelocity: calculateSprintPlanning(session.input).sprintVelocity,
      pendingLeaveConfirmations: session.leaveConfirmations.filter(
        (confirmation) => confirmation.confirmationStatus === "pending"
      ).length,
      connectorPendingSteps: calculateSprintPlanning(session.input).checklist.filter(
        (step) => step.status === "connector-pending"
      ).length,
      updatedAt: session.updatedAt
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getSprintPlanningSession(sessionId: string) {
  const store = await readStore();
  const session = store.sessions.find((candidate) => candidate.sessionId === sessionId);

  return session ? serializeSprintPlanningSession(session) : null;
}

export async function saveSprintPlanningSession(input: SprintPlanningSessionSaveInput) {
  const store = await readStore();
  const now = new Date().toISOString();
  const sessionId = input.sessionId ?? createSessionId(input);
  const existingSession = store.sessions.find((session) => session.sessionId === sessionId);
  const nextSession: SprintPlanningSession = {
    ...input,
    sessionId,
    createdAt: existingSession?.createdAt ?? now,
    updatedAt: now
  };

  store.sessions = existingSession
    ? store.sessions.map((session) => (session.sessionId === sessionId ? nextSession : session))
    : [...store.sessions, nextSession];

  await writeStore(store);

  return serializeSprintPlanningSession(nextSession);
}
