import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SprintPlanningSessionCloneInput, SprintPlanningSessionSaveInput } from "./schema.js";
import {
  calculateSprintPlanning,
  createJiraReportingImportPreview
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

export type SprintPlanningConnectorActionKey = "fetch-closed-story-points";

export type SprintPlanningConnectorActionResult = {
  actionKey: SprintPlanningConnectorActionKey;
  connector: "jira";
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

function addDays(dateValue: string, days: number) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return dateValue;
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function nextSprintName(previousSprintName: string) {
  const match = previousSprintName.match(/^Q(\d+)S(\d+)\s*-\s*(\d{4})$/i);

  if (!match) {
    return `${previousSprintName} copy`;
  }

  return `Q${match[1]}S${Number(match[2]) + 1} - ${match[3]}`;
}

function roundVelocity(value: number) {
  return Math.round(value * 10) / 10;
}

function perDeveloperVelocity(value: number, teamMemberCount: number) {
  return teamMemberCount > 0 ? roundVelocity(value / teamMemberCount) : 0;
}

function cloneVelocityHistory(session: SprintPlanningSession, currentSprintName: string) {
  const previousRows = session.velocityHistory;
  const minus2 = previousRows.find((row) => row.sprintOffset === -2);
  const minus1 = previousRows.find((row) => row.sprintOffset === -1);

  return [
    minus2
      ? {
          ...minus2,
          sprintOffset: -3 as const,
          source: "manual" as const
        }
      : {
          sprintOffset: -3 as const,
          sprintName: session.input.previousSprintName,
          startDate: session.input.previousSprintDates.start,
          endDate: session.input.previousSprintDates.end,
          completedStoryPoints: session.input.previousVelocityMinus2,
          leaveDays: session.input.previousSprintLeaveDays,
          netVelocity: session.input.previousVelocityMinus2,
          source: "manual" as const,
          includeInAverage: true
        },
    minus1
      ? {
          ...minus1,
          sprintOffset: -2 as const,
          source: "manual" as const
        }
      : {
          sprintOffset: -2 as const,
          sprintName: session.input.currentSprintName,
          startDate: session.input.currentSprintDates.start,
          endDate: session.input.currentSprintDates.end,
          completedStoryPoints: session.input.lastNetVelocity,
          leaveDays: session.input.upcomingSprintLeaveDays,
          netVelocity: session.input.lastNetVelocity,
          source: "manual" as const,
          includeInAverage: true
        },
    {
      sprintOffset: -1 as const,
      sprintName: session.input.currentSprintName,
      startDate: session.input.currentSprintDates.start,
      endDate: session.input.currentSprintDates.end,
      completedStoryPoints: session.input.lastNetVelocity,
      leaveDays: session.input.upcomingSprintLeaveDays,
      netVelocity: session.input.lastNetVelocity,
      source: "manual" as const,
      includeInAverage: true
    }
  ].map((row) => ({
    ...row,
    sprintName: row.sprintOffset === -1 ? session.input.currentSprintName : row.sprintName || currentSprintName
  }));
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
    .map((session) => {
      const sprintVelocity = calculateSprintPlanning(session.input).sprintVelocity;

      return {
        sessionId: session.sessionId,
        teamKey: session.input.teamKey,
        teamName: session.input.teamName,
        currentSprintName: session.input.currentSprintName,
        previousSprintName: session.input.previousSprintName,
        currentSprintDates: session.input.currentSprintDates,
        planningStatus: session.planningStatus,
        sprintVelocity,
        sprintVelocityPerDeveloper: perDeveloperVelocity(sprintVelocity, session.input.teamMemberCount),
        teamMemberCount: session.input.teamMemberCount,
        pendingLeaveConfirmations: session.leaveConfirmations.filter(
          (confirmation) => confirmation.confirmationStatus === "pending"
        ).length,
        connectorPendingSteps: serializeSprintPlanningSession(session).output.checklist.filter(
          (step) => step.status === "connector-pending"
        ).length,
        updatedAt: session.updatedAt
      };
    })
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

export async function cloneSprintPlanningSession(sessionId: string, input: SprintPlanningSessionCloneInput) {
  const store = await readStore();
  const existingSession = store.sessions.find((session) => session.sessionId === sessionId);

  if (!existingSession) {
    return null;
  }

  const now = new Date().toISOString();
  const currentSprintName = input.currentSprintName ?? nextSprintName(existingSession.input.currentSprintName);
  const currentSprintDates = input.currentSprintDates ?? {
    start: addDays(existingSession.input.currentSprintDates.start, 14),
    end: addDays(existingSession.input.currentSprintDates.end, 14)
  };
  const velocityHistory = cloneVelocityHistory(existingSession, currentSprintName);
  const nextInput = {
    ...existingSession.input,
    previousSprintName: existingSession.input.currentSprintName,
    currentSprintName,
    previousSprintDates: existingSession.input.currentSprintDates,
    currentSprintDates,
    previousVelocityMinus3:
      velocityHistory.find((row) => row.sprintOffset === -3)?.netVelocity ??
      existingSession.input.previousVelocityMinus2,
    previousVelocityMinus2:
      velocityHistory.find((row) => row.sprintOffset === -2)?.netVelocity ??
      existingSession.input.lastNetVelocity,
    lastNetVelocity:
      velocityHistory.find((row) => row.sprintOffset === -1)?.netVelocity ?? existingSession.input.lastNetVelocity,
    previousSprintLeaveDays:
      velocityHistory.find((row) => row.sprintOffset === -1)?.leaveDays ?? existingSession.input.upcomingSprintLeaveDays,
    upcomingSprintLeaveDays: 0,
    manualVelocityOverride: null,
    velocityOverrideReason: ""
  };
  const nextSession: SprintPlanningSession = {
    sessionId: createSessionId({
      planningStatus: "draft",
      input: nextInput,
      velocityHistory,
      leaveConfirmations: []
    }),
    planningStatus: "draft",
    input: nextInput,
    velocityHistory,
    leaveConfirmations: [],
    connectorActions: [],
    createdAt: now,
    updatedAt: now
  };

  store.sessions = [...store.sessions, nextSession];
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

    return currentSession;
  });

  return session && actionResult
    ? {
        session,
        action: actionResult
      }
    : null;
}
