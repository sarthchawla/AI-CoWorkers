import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSprintPlanningConnectorModeLabel } from "../connectors/connectorEnvironment.js";
import type { SprintPlanningSessionSaveInput } from "./schema.js";
import {
  calculateSprintPlanning,
  createJiraReportingImportPreview,
  createSlackLeaveConfirmationImportPreview
} from "./service.js";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../../..");
const defaultStorePath = path.join(repoRoot, "data", "sprint-planning-sessions.json");
const storePath = process.env.SPRINT_PLANNING_DATA_FILE ?? defaultStorePath;

export type SprintPlanningSession = SprintPlanningSessionSaveInput & {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  connectorActions?: SprintPlanningConnectorActionResult[];
};

export type SprintPlanningConnectorActionKey =
  | "collect-leaves"
  | "close-previous-sprint"
  | "fetch-closed-story-points";

export type SprintPlanningConnectorActionResult = {
  actionKey: SprintPlanningConnectorActionKey;
  connector: "jira" | "slack";
  mode: "mock";
  status: "done";
  ranAt: string;
  output: Record<string, unknown>;
  warnings: string[];
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

async function updateSession(
  sessionId: string,
  update: (session: SprintPlanningSession, now: string) => SprintPlanningSession
) {
  const store = await readStore();
  const now = new Date().toISOString();
  const existingSession = store.sessions.find((session) => session.sessionId === sessionId);

  if (!existingSession) {
    return null;
  }

  const nextSession = update(existingSession, now);

  store.sessions = store.sessions.map((session) => (session.sessionId === sessionId ? nextSession : session));
  await writeStore(store);

  return serializeSprintPlanningSession(nextSession);
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
  const actionResults = session.connectorActions ?? [];
  const completedActionKeys = new Set(actionResults.map((action) => action.actionKey));
  const output = calculateSprintPlanning(session.input);

  return {
    ...session,
    connectorActions: actionResults,
    output: {
      ...output,
      checklist: output.checklist.map((step) => {
        const actionKey = step.id === "fetch-last-net-velocity" ? "fetch-closed-story-points" : step.id;

        return completedActionKeys.has(actionKey as SprintPlanningConnectorActionKey)
          ? { ...step, status: "done" }
          : step;
      }),
      automationPlan: output.automationPlan.map((step) =>
        completedActionKeys.has(step.id as SprintPlanningConnectorActionKey) ? { ...step, status: "done" } : step
      )
    }
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
      connectorPendingSteps: serializeSprintPlanningSession(session).output.checklist.filter(
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

function upsertActionResult(
  actions: SprintPlanningConnectorActionResult[] | undefined,
  result: SprintPlanningConnectorActionResult
) {
  const existingActions = actions ?? [];
  return [
    ...existingActions.filter((action) => action.actionKey !== result.actionKey),
    result
  ].sort((left, right) => left.ranAt.localeCompare(right.ranAt));
}

export async function runSprintPlanningConnectorAction(
  sessionId: string,
  actionKey: SprintPlanningConnectorActionKey
) {
  let actionResult: SprintPlanningConnectorActionResult | null = null;
  const session = await updateSession(sessionId, (currentSession, now) => {
    if (actionKey === "collect-leaves") {
      const preview = createSlackLeaveConfirmationImportPreview({
        teamKey: currentSession.input.teamKey,
        slackChannel: currentSession.input.slackChannel,
        previousSprintName: currentSession.input.previousSprintName,
        currentSprintName: currentSession.input.currentSprintName
      });
      const confirmations = preview.confirmations.map((confirmation) => ({
        ...confirmation
      })) as SprintPlanningSession["leaveConfirmations"];

      actionResult = {
        actionKey,
        connector: "slack",
        mode: "mock",
        status: "done",
        ranAt: now,
        output: {
          requestPreview: preview.requestPreview,
          confirmations
        },
        warnings: preview.warnings
      };

      return {
        ...currentSession,
        input: {
          ...currentSession.input,
          ...preview.formPatch
        },
        leaveConfirmations: confirmations,
        connectorActions: upsertActionResult(currentSession.connectorActions, actionResult),
        updatedAt: now
      };
    }

    if (actionKey === "fetch-closed-story-points") {
      const preview = createJiraReportingImportPreview({
        teamKey: currentSession.input.teamKey,
        jiraProjectKey: currentSession.input.jiraProjectKey,
        jiraBoardName: currentSession.input.jiraBoardName,
        previousSprintName: currentSession.input.previousSprintName,
        currentSprintName: currentSession.input.currentSprintName,
        sprintCount: 3
      });
      const velocityHistory = preview.velocityHistory.map((row) => ({
        ...row
      })) as SprintPlanningSession["velocityHistory"];
      const lastSprintLeaveDays =
        velocityHistory.find((row) => row.sprintOffset === -1)?.leaveDays ??
        currentSession.input.previousSprintLeaveDays;

      actionResult = {
        actionKey,
        connector: "jira",
        mode: "mock",
        status: "done",
        ranAt: now,
        output: {
          velocityHistory,
          previousSprintClosedStoryPoints: preview.previousSprintClosedStoryPoints
        },
        warnings: preview.warnings
      };

      return {
        ...currentSession,
        input: {
          ...currentSession.input,
          ...preview.formPatch,
          previousSprintLeaveDays: lastSprintLeaveDays
        },
        velocityHistory,
        connectorActions: upsertActionResult(currentSession.connectorActions, actionResult),
        updatedAt: now
      };
    }

    const jiraSprintId =
      currentSession.velocityHistory.find((row) => row.sprintOffset === -1)?.jiraSprintId ??
      `mock-${currentSession.input.previousSprintName.toLowerCase().replaceAll(" ", "-")}`;

    actionResult = {
      actionKey,
      connector: "jira",
      mode: "mock",
      status: "done",
      ranAt: now,
      output: {
        previousSprintName: currentSession.input.previousSprintName,
        jiraBoardName: currentSession.input.jiraBoardName,
        jiraSprintId
      },
      warnings: [
        `Using ${getSprintPlanningConnectorModeLabel()} Jira sprint closure until Jira API or MCP connector is configured.`
      ]
    };

    return {
      ...currentSession,
      connectorActions: upsertActionResult(currentSession.connectorActions, actionResult),
      updatedAt: now
    };
  });

  return session && actionResult
    ? {
        session,
        action: actionResult
      }
    : null;
}
