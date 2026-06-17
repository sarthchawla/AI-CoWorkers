import { useEffect, useMemo, useState } from "react";
import type { HTMLAttributes } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FolderOpen,
  Goal,
  History,
  ListChecks,
  MessageSquare,
  Plus,
  Save as SaveIcon,
  Settings2,
  Sparkles,
  Table2
} from "lucide-react";
import {
  cloneSprintPlanningSession,
  createSprintPlanningWorkflowDraft,
  getSprintPlanningSession,
  getJiraVelocityHistory,
  getScrumMasterStatus,
  getSlackLeaveConfirmations,
  getSprintPlanningTeamConfig,
  listSprintPlanningSessions,
  runSprintPlanningConnectorAction,
  saveSprintPlanningTeamConfig,
  saveSprintPlanningSession
} from "./sprintPlanningApi";
import { calculatePlanning, toNumber, toSprintPlanningInput } from "./sprintPlanningCalculations";
import type {
  AutomationStep,
  DraftResponse,
  LeaveConfirmationRow,
  PlanningStatus,
  PlanningForm,
  ScrumMasterStatusResponse,
  SavedSprintPlanningSession,
  SavedSprintPlanningSessionSummary,
  SprintPlanningConnectorActionKey,
  SprintPlanningInput,
  VelocityHistoryRow,
  WorkflowStepId,
  WorkflowStepState
} from "./sprintPlanningTypes";

const initialForm: PlanningForm = {
  teamKey: "pta",
  teamName: "PTA",
  jiraProjectName: "PTA",
  jiraProjectKey: "PTATPA",
  jiraBoardName: "PTA Sprint Board",
  slackChannel: "#pta-sprint-planning",
  sprintNamingPattern: "Q{quarter}S{sprint} - {year}",
  previousSprintName: "Q2S6 - 2026",
  currentSprintName: "Q2S7 - 2026",
  previousSprintStart: "2026-06-01",
  previousSprintEnd: "2026-06-12",
  currentSprintStart: "2026-06-15",
  currentSprintEnd: "2026-06-26",
  daysInSprintExcludingHolidays: 10,
  holidayCount: 0,
  teamMemberCount: 5,
  previousVelocityMinus3: 82,
  previousVelocityMinus2: 88,
  lastNetVelocity: 84,
  previousSprintLeaveDays: 2,
  upcomingSprintLeaveDays: 3,
  confidenceAdjustment: 0,
  manualVelocityPerDeveloperOverride: "",
  velocityOverrideReason: ""
};

const workflowSteps: AutomationStep[] = [
  {
    id: "clone",
    label: "Start from previous sprint context instead of cloning an Excel tab.",
    owner: "AI Scrum Master",
    status: "replaced-by-app"
  },
  {
    id: "dates",
    label: "Carry sprint dates, working days, and holidays into the new sprint plan.",
    owner: "AI Scrum Master",
    status: "ready"
  },
  {
    id: "leaves",
    label: "Ask the configured Slack channel for previous and upcoming sprint leave updates.",
    owner: "Slack connector",
    status: "connector-pending"
  },
  {
    id: "jira-close",
    label: "Close the previous Jira sprint and read net velocity per developer from reporting.",
    owner: "Jira connector",
    status: "connector-pending"
  },
  {
    id: "velocity",
    label: "Calculate average net velocity/dev, capacity adjustment, and final team-approved net velocity/dev.",
    owner: "AI Scrum Master",
    status: "ready"
  }
];

const initialVelocityHistory: VelocityHistoryRow[] = [
  {
    sprintOffset: -3,
    sprintName: "Q2S4 - 2026",
    startDate: "2026-05-05",
    endDate: "2026-05-16",
    completedStoryPoints: 82,
    leaveDays: 1,
    netVelocity: 82,
    source: "manual",
    includeInAverage: true
  },
  {
    sprintOffset: -2,
    sprintName: "Q2S5 - 2026",
    startDate: "2026-05-19",
    endDate: "2026-05-30",
    completedStoryPoints: 88,
    leaveDays: 2,
    netVelocity: 88,
    source: "manual",
    includeInAverage: true
  },
  {
    sprintOffset: -1,
    sprintName: "Q2S6 - 2026",
    startDate: "2026-06-01",
    endDate: "2026-06-12",
    completedStoryPoints: 84,
    leaveDays: 2,
    netVelocity: 84,
    source: "manual",
    includeInAverage: true
  }
];

const initialLeaveConfirmations: LeaveConfirmationRow[] = [
  {
    teammateName: "Anika",
    slackUserId: "U-ANIKA",
    previousSprintLeaveDays: 0,
    upcomingSprintLeaveDays: 1,
    confirmationStatus: "confirmed",
    source: "manual"
  },
  {
    teammateName: "Dev",
    slackUserId: "U-DEV",
    previousSprintLeaveDays: 1,
    upcomingSprintLeaveDays: 0,
    confirmationStatus: "confirmed",
    source: "manual"
  },
  {
    teammateName: "Mei",
    slackUserId: "U-MEI",
    previousSprintLeaveDays: 0.5,
    upcomingSprintLeaveDays: 1,
    confirmationStatus: "updated_by_sm",
    source: "manual"
  },
  {
    teammateName: "Ravi",
    slackUserId: "U-RAVI",
    previousSprintLeaveDays: 0,
    upcomingSprintLeaveDays: 0,
    confirmationStatus: "pending",
    source: "manual"
  },
  {
    teammateName: "Sara",
    slackUserId: "U-SARA",
    previousSprintLeaveDays: 0.5,
    upcomingSprintLeaveDays: 1,
    confirmationStatus: "confirmed",
    source: "manual"
  }
];

const statusLabels: Record<AutomationStep["status"], string> = {
  ready: "Ready",
  "connector-pending": "Connector pending",
  "team-input": "Team input",
  "replaced-by-app": "Excel replaced",
  done: "Done"
};

const workflowStepDefinitions: Array<{
  id: WorkflowStepId;
  title: string;
  description: string;
  primaryAction: string;
  connector?: "jira" | "slack";
}> = [
  {
    id: "clone",
    title: "Start from previous sprint",
    description: "Open or clone a saved sprint, or prepare this draft from the previous sprint context.",
    primaryAction: "Clone sprint"
  },
  {
    id: "calendar",
    title: "Carry calendar context",
    description: "Edit sprint names, dates, working days excluding holidays, holiday count, and team defaults.",
    primaryAction: "Confirm calendar"
  },
  {
    id: "velocity-baseline",
    title: "Review net velocity/dev baseline",
    description: "Import or edit the -3, -2, and provisional -1 sprint net velocity/dev values used for the average.",
    primaryAction: "Confirm baseline",
    connector: "jira"
  },
  {
    id: "slack-leaves",
    title: "Collect Slack leave updates",
    description: "Pull leave confirmations, then edit each teammate row before capacity is recalculated.",
    primaryAction: "Import Slack leaves",
    connector: "slack"
  },
  {
    id: "jira-close",
    title: "Close Jira sprint",
    description: "Record the previous sprint closure action against the saved planning session.",
    primaryAction: "Close Jira sprint",
    connector: "jira"
  },
  {
    id: "jira-reporting",
    title: "Pull Jira net velocity/dev",
    description: "Fetch reporting values for the closed sprint, then edit the final -1 net velocity per developer if needed.",
    primaryAction: "Pull net velocity/dev",
    connector: "jira"
  },
  {
    id: "velocity-decision",
    title: "Calculate net velocity/dev and override",
    description: "Review the calculated net velocity per developer and apply a team-approved override when context supports it.",
    primaryAction: "Finalize net velocity/dev"
  },
  {
    id: "finalize",
    title: "Finalize sprint plan",
    description: "Save the session, set review status, and inspect Slack/Jira previews before publishing later.",
    primaryAction: "Save final plan"
  }
];

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function countWeekdays(startValue: string, endValue: string) {
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getDay();

    if (day !== 0 && day !== 6) {
      count += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function nextSprintName(previousSprintName: string, pattern: string) {
  const match = previousSprintName.match(/^Q(\d+)S(\d+)\s*-\s*(\d{4})$/i);

  if (!match) {
    return previousSprintName;
  }

  return pattern
    .replaceAll("{quarter}", match[1])
    .replaceAll("{sprint}", String(Number(match[2]) + 1))
    .replaceAll("{year}", match[3]);
}

function fallbackSlackPreview(form: PlanningForm) {
  return [
    `Hi team, please update leaves for ${form.previousSprintName} and ${form.currentSprintName}.`,
    `Current plan has ${form.previousSprintLeaveDays} previous sprint leave days and ${form.upcomingSprintLeaveDays} upcoming sprint leave days recorded.`,
    "Please reply with any corrections before sprint planning is finalized."
  ].join("\n");
}

function formatSavedAt(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toPerDeveloperOverride(input: SprintPlanningInput) {
  if (input.manualVelocityOverride == null || input.teamMemberCount <= 0) {
    return "";
  }

  return String(Math.round((input.manualVelocityOverride / input.teamMemberCount) * 10) / 10);
}

function toPerDeveloperVelocity(value: number, teamMemberCount: number) {
  return teamMemberCount > 0 ? Math.round((value / teamMemberCount) * 10) / 10 : 0;
}

function toPlanningForm(input: SprintPlanningInput): PlanningForm {
  return {
    teamKey: input.teamKey ?? "",
    teamName: input.teamName,
    jiraProjectName: "",
    jiraProjectKey: input.jiraProjectKey,
    jiraBoardName: input.jiraBoardName,
    slackChannel: input.slackChannel,
    sprintNamingPattern: "Q{quarter}S{sprint} - {year}",
    previousSprintName: input.previousSprintName,
    currentSprintName: input.currentSprintName,
    previousSprintStart: input.previousSprintDates.start,
    previousSprintEnd: input.previousSprintDates.end,
    currentSprintStart: input.currentSprintDates.start,
    currentSprintEnd: input.currentSprintDates.end,
    daysInSprintExcludingHolidays: input.daysInSprintExcludingHolidays,
    holidayCount: input.holidayCount,
    teamMemberCount: input.teamMemberCount,
    previousVelocityMinus3: input.previousVelocityMinus3,
    previousVelocityMinus2: input.previousVelocityMinus2,
    lastNetVelocity: input.lastNetVelocity,
    previousSprintLeaveDays: input.previousSprintLeaveDays,
    upcomingSprintLeaveDays: input.upcomingSprintLeaveDays,
    confidenceAdjustment: input.confidenceAdjustment,
    manualVelocityPerDeveloperOverride: toPerDeveloperOverride(input),
    velocityOverrideReason: input.velocityOverrideReason
  };
}

export function SprintPlanningWorkflow() {
  const [form, setForm] = useState(initialForm);
  const [velocityHistory, setVelocityHistory] = useState(initialVelocityHistory);
  const [leaveConfirmations, setLeaveConfirmations] = useState(initialLeaveConfirmations);
  const [draftStatus, setDraftStatus] = useState("Not synced with API yet");
  const [apiPlan, setApiPlan] = useState<DraftResponse["data"] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [planningStatus, setPlanningStatus] = useState<PlanningStatus>("draft");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedSprintPlanningSessionSummary[]>([]);
  const [viewMode, setViewMode] = useState<"home" | "workflow">("home");
  const [isSessionBrowserOpen, setIsSessionBrowserOpen] = useState(false);
  const [isConnectorRunning, setIsConnectorRunning] = useState(false);
  const [activeStepId, setActiveStepId] = useState<WorkflowStepId>("clone");
  const [completedStepIds, setCompletedStepIds] = useState<WorkflowStepId[]>([]);
  const [scrumMasterStatus, setScrumMasterStatus] = useState<ScrumMasterStatusResponse | null>(null);
  const planning = useMemo(() => calculatePlanning(form), [form]);
  const apiOutput = apiPlan?.output;
  const workflowChecklist = apiOutput?.checklist ?? workflowSteps;
  const slackPreview = apiOutput?.slackLeaveRequestPreview ?? fallbackSlackPreview(form);
  const activeStep = workflowStepDefinitions.find((step) => step.id === activeStepId) ?? workflowStepDefinitions[0];

  useEffect(() => {
    getScrumMasterStatus()
      .then((payload) => setScrumMasterStatus(payload))
      .catch(() => setScrumMasterStatus(null));
  }, []);

  useEffect(() => {
    refreshSavedSessions("Loading sprint planning sessions...");
  }, []);

  function markDirty() {
    setIsDirty(true);
  }

  function completeStep(stepId: WorkflowStepId, nextStepId?: WorkflowStepId) {
    setCompletedStepIds((current) => (current.includes(stepId) ? current : [...current, stepId]));

    if (nextStepId) {
      setActiveStepId(nextStepId);
    }
  }

  function skipStep(stepId: WorkflowStepId) {
    const currentIndex = workflowStepDefinitions.findIndex((step) => step.id === stepId);
    const nextStep = workflowStepDefinitions[currentIndex + 1];

    completeStep(stepId, nextStep?.id);
    setDraftStatus(`${workflowStepDefinitions[currentIndex]?.title ?? "Workflow step"} skipped; editable values kept`);
  }

  function getWorkflowStepState(stepId: WorkflowStepId): WorkflowStepState {
    if (stepId === activeStepId) {
      return "current";
    }

    if (completedStepIds.includes(stepId)) {
      return "completed";
    }

    const stepIndex = workflowStepDefinitions.findIndex((step) => step.id === stepId);
    const previousStepsComplete = workflowStepDefinitions
      .slice(0, stepIndex)
      .every((step) => completedStepIds.includes(step.id));

    return previousStepsComplete ? "available" : "locked";
  }

  function navigateWorkflowStep(stepId: WorkflowStepId) {
    const state = getWorkflowStepState(stepId);

    if (state !== "locked") {
      setActiveStepId(stepId);
    }
  }

  function updateText(field: keyof PlanningForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
    markDirty();
  }

  function updateNumber(field: keyof PlanningForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: toNumber(value)
    }));
    markDirty();
  }

  function patchVelocityFields(rows: VelocityHistoryRow[]) {
    setForm((current) => ({
      ...current,
      previousVelocityMinus3:
        rows.find((row) => row.sprintOffset === -3)?.netVelocity ?? current.previousVelocityMinus3,
      previousVelocityMinus2:
        rows.find((row) => row.sprintOffset === -2)?.netVelocity ?? current.previousVelocityMinus2,
      lastNetVelocity: rows.find((row) => row.sprintOffset === -1)?.netVelocity ?? current.lastNetVelocity,
      previousSprintLeaveDays:
        rows.find((row) => row.sprintOffset === -1)?.leaveDays ?? current.previousSprintLeaveDays
    }));
  }

  function updateVelocityHistory(
    sprintOffset: VelocityHistoryRow["sprintOffset"],
    field: keyof Pick<VelocityHistoryRow, "netVelocity">,
    value: string
  ) {
    const nextRows = velocityHistory.map((row) => {
      if (row.sprintOffset !== sprintOffset) {
        return row;
      }

      return {
        ...row,
        [field]: toNumber(value),
        source: "manual" as const
      };
    });

    setVelocityHistory(nextRows);
    patchVelocityFields(nextRows);
    markDirty();
  }

  function patchLeaveTotals(rows: LeaveConfirmationRow[]) {
    setForm((current) => ({
      ...current,
      previousSprintLeaveDays: rows.reduce((sum, row) => sum + row.previousSprintLeaveDays, 0),
      upcomingSprintLeaveDays: rows.reduce((sum, row) => sum + row.upcomingSprintLeaveDays, 0)
    }));
  }

  function updateLeaveConfirmation(
    slackUserId: string,
    field: keyof Pick<LeaveConfirmationRow, "previousSprintLeaveDays" | "upcomingSprintLeaveDays">,
    value: string
  ) {
    const nextRows = leaveConfirmations.map((row) => {
      if (row.slackUserId !== slackUserId) {
        return row;
      }

      return {
        ...row,
        [field]: toNumber(value),
        confirmationStatus: "updated_by_sm" as const,
        source: "manual" as const
      };
    });

    setLeaveConfirmations(nextRows);
    patchLeaveTotals(nextRows);
    markDirty();
  }

  async function generateDraft() {
    setDraftStatus("Generating workflow draft...");

    try {
      const payload = await createSprintPlanningWorkflowDraft(toSprintPlanningInput(form));
      setApiPlan(payload.data ?? null);
      setDraftStatus("Draft generated from backend workflow engine");
      return true;
    } catch {
      setDraftStatus("API unavailable; showing local calculation");
      return false;
    }
  }

  async function loadTeamConfig() {
    setDraftStatus("Loading team sprint-planning config...");

    try {
      const payload = await getSprintPlanningTeamConfig(form.teamKey);
      const config = payload.data;

      setForm((current) => ({
        ...current,
        teamKey: config.teamKey,
        teamName: config.teamName,
        jiraProjectName: config.jira.projectName ?? "",
        jiraProjectKey: config.jira.projectKey,
        jiraBoardName: config.jira.boardName,
        slackChannel: config.slack.channelName,
        teamMemberCount: config.defaults.teamMemberCount,
        daysInSprintExcludingHolidays: config.defaults.daysInSprintExcludingHolidays,
        sprintNamingPattern: config.defaults.sprintNamingPattern ?? current.sprintNamingPattern
      }));
      setDraftStatus("Team config loaded from backend defaults");
      markDirty();
    } catch {
      setDraftStatus("Team config unavailable; keep editing local values");
    }
  }

  async function saveTeamConfig() {
    setDraftStatus("Saving team connector config...");

    try {
      const payload = await saveSprintPlanningTeamConfig({
        teamKey: form.teamKey,
        teamName: form.teamName,
        jira: {
          projectName: form.jiraProjectName,
          projectKey: form.jiraProjectKey,
          boardName: form.jiraBoardName
        },
        slack: {
          channelName: form.slackChannel
        },
        defaults: {
          teamMemberCount: form.teamMemberCount,
          daysInSprintExcludingHolidays: form.daysInSprintExcludingHolidays,
          sprintNamingPattern: form.sprintNamingPattern
        }
      });
      const config = payload.data;

      setForm((current) => ({
        ...current,
        teamKey: config.teamKey,
        teamName: config.teamName,
        jiraProjectName: config.jira.projectName ?? "",
        jiraProjectKey: config.jira.projectKey,
        jiraBoardName: config.jira.boardName,
        slackChannel: config.slack.channelName,
        teamMemberCount: config.defaults.teamMemberCount,
        daysInSprintExcludingHolidays: config.defaults.daysInSprintExcludingHolidays,
        sprintNamingPattern: config.defaults.sprintNamingPattern ?? current.sprintNamingPattern
      }));
      setDraftStatus("Team connector config saved for mock environment");
    } catch {
      setDraftStatus("Team connector config save failed");
    }
  }

  async function importJiraVelocityHistory() {
    setDraftStatus("Importing velocity history from Jira reporting...");

    try {
      const payload = await getJiraVelocityHistory({
        teamKey: form.teamKey,
        jiraProjectKey: form.jiraProjectKey,
        jiraBoardName: form.jiraBoardName,
        previousSprintName: form.previousSprintName
      });
      const rows = payload.data.velocityHistory;

      setVelocityHistory(rows);
      setForm((current) => ({
        ...current,
        ...payload.data.formPatch,
        previousSprintLeaveDays:
          rows.find((row) => row.sprintOffset === -1)?.leaveDays ?? current.previousSprintLeaveDays
      }));
      setDraftStatus("Imported last three sprint velocities from Jira reporting");
      markDirty();
      return true;
    } catch {
      setDraftStatus("Jira reporting import unavailable; keep editing velocity rows");
      return false;
    }
  }

  async function importSlackLeaveConfirmations() {
    setDraftStatus("Collecting leave confirmations from Slack preview...");

    try {
      const payload = await getSlackLeaveConfirmations({
        teamKey: form.teamKey,
        slackChannel: form.slackChannel,
        previousSprintName: form.previousSprintName,
        currentSprintName: form.currentSprintName
      });

      setLeaveConfirmations(payload.data.confirmations);
      setForm((current) => ({
        ...current,
        ...payload.data.formPatch
      }));
      setDraftStatus("Imported leave confirmations from mock Slack thread");
      markDirty();
      return true;
    } catch {
      setDraftStatus("Slack leave confirmation import unavailable; keep editing leave rows");
      return false;
    }
  }

  function clonePreviousSprint() {
    setForm((current) => ({
      ...current,
      currentSprintName: nextSprintName(current.previousSprintName, current.sprintNamingPattern),
      currentSprintStart: addDays(current.previousSprintStart, 14),
      currentSprintEnd: addDays(current.previousSprintEnd, 14),
      previousVelocityMinus3: current.previousVelocityMinus2,
      previousVelocityMinus2: current.lastNetVelocity
    }));
    setDraftStatus("Prepared current sprint from previous sprint context");
    markDirty();
  }

  function calculateWorkingDays() {
    setForm((current) => ({
      ...current,
      daysInSprintExcludingHolidays: Math.max(
        countWeekdays(current.currentSprintStart, current.currentSprintEnd) - current.holidayCount,
        0
      )
    }));
    setDraftStatus("Calculated working days from current sprint dates and holidays");
    markDirty();
  }

  async function saveSession() {
    setDraftStatus("Saving sprint planning session...");

    try {
      const payload = await saveSprintPlanningSession({
        sessionId: sessionId ?? undefined,
        planningStatus,
        planningInput: toSprintPlanningInput(form),
        velocityHistory,
        leaveConfirmations
      });

      setSessionId(payload.data.sessionId);
      setLastSavedAt(payload.data.updatedAt);
      setApiPlan({
        output: payload.data.output
      });
      setIsDirty(false);
      setDraftStatus("Sprint planning session saved");
      void refreshSavedSessions();
      return true;
    } catch {
      setDraftStatus("Save failed; keep the session open and try again");
      return false;
    }
  }

  function hydrateSavedSession(session: SavedSprintPlanningSession, statusMessage: string) {
    setForm((current) => ({
      ...toPlanningForm(session.input),
      jiraProjectName: current.jiraProjectName,
      sprintNamingPattern: current.sprintNamingPattern
    }));
    setVelocityHistory(session.velocityHistory);
    setLeaveConfirmations(session.leaveConfirmations);
    setPlanningStatus(session.planningStatus);
    setSessionId(session.sessionId);
    setLastSavedAt(session.updatedAt);
    setApiPlan({
      output: session.output
    });
    setIsDirty(false);
    setDraftStatus(statusMessage);
  }

  async function openSessionBrowser() {
    await refreshSavedSessions("Loading saved sprint planning sessions...");
    setIsSessionBrowserOpen(true);
  }

  async function refreshSavedSessions(loadingMessage?: string) {
    if (loadingMessage) {
      setDraftStatus(loadingMessage);
    }

    try {
      const payload = await listSprintPlanningSessions(form.teamKey);

      setSavedSessions(payload.data);
      setDraftStatus(payload.data.length > 0 ? "Saved sessions loaded" : "No saved sessions for this team yet");
    } catch {
      setDraftStatus("Saved sessions unavailable");
    }
  }

  function startNewPlanningSession() {
    setSessionId(null);
    setPlanningStatus("draft");
    setLastSavedAt("");
    setApiPlan(null);
    setIsDirty(true);
    setCompletedStepIds([]);
    setActiveStepId("clone");
    setIsSessionBrowserOpen(false);
    setViewMode("workflow");
    setDraftStatus("New sprint planning session started");
  }

  async function loadSession(nextSessionId: string) {
    setDraftStatus("Opening saved sprint planning session...");

    try {
      const payload = await getSprintPlanningSession(nextSessionId);
      const session = payload.data;

      setIsSessionBrowserOpen(false);
      setViewMode("workflow");
      hydrateSavedSession(session, `Opened saved session for ${session.input.currentSprintName}`);
      completeStep("clone", "calendar");
    } catch {
      setDraftStatus("Saved session could not be opened");
    }
  }

  async function cloneSavedSession(sourceSessionId: string) {
    if (isDirty) {
      setDraftStatus("Save changes before cloning a sprint planning session");
      return;
    }

    if (isConnectorRunning) {
      setDraftStatus("Wait for the connector action to finish before cloning a sprint planning session");
      return;
    }

    setDraftStatus("Creating next sprint planning session from saved context...");

    try {
      const payload = await cloneSprintPlanningSession(sourceSessionId);
      hydrateSavedSession(payload.data, `Created ${payload.data.input.currentSprintName} from previous sprint context`);
      setIsSessionBrowserOpen(false);
      setViewMode("workflow");
      completeStep("clone", "calendar");
    } catch {
      setDraftStatus("Saved session clone failed");
    }
  }

  async function runSavedConnectorAction(actionKey: SprintPlanningConnectorActionKey) {
    if (sessionId == null) {
      setDraftStatus("Save this planning session before running connectors");
      return false;
    }

    if (isDirty) {
      setDraftStatus("Save changes before running connectors against this session");
      return false;
    }

    const runningMessages: Record<SprintPlanningConnectorActionKey, string> = {
      "collect-leaves": "Collecting saved-session Slack leave confirmations...",
      "close-previous-sprint": "Closing previous sprint in saved-session Jira preview...",
      "fetch-closed-story-points": "Importing saved-session Jira net velocity/dev..."
    };
    const successMessages: Record<SprintPlanningConnectorActionKey, string> = {
      "collect-leaves": "Slack leave confirmations updated in saved session",
      "close-previous-sprint": "Previous sprint closure recorded in saved session",
      "fetch-closed-story-points": "Jira closed sprint net velocity/dev updated in saved session"
    };

    setDraftStatus(runningMessages[actionKey]);
    setIsConnectorRunning(true);

    try {
      const payload = await runSprintPlanningConnectorAction(sessionId, actionKey);
      hydrateSavedSession(payload.data.session, successMessages[actionKey]);
      return true;
    } catch {
      setDraftStatus("Connector action failed; saved session was not updated");
      return false;
    } finally {
      setIsConnectorRunning(false);
    }
  }

  async function runSavedConnectorWorkflow() {
    await runSavedConnectorAction("collect-leaves");
    await runSavedConnectorAction("close-previous-sprint");
    await runSavedConnectorAction("fetch-closed-story-points");
  }

  async function runActiveStepPrimaryAction() {
    if (activeStepId === "clone") {
      clonePreviousSprint();
      completeStep("clone", "calendar");
      return;
    }

    if (activeStepId === "calendar") {
      calculateWorkingDays();
      completeStep("calendar", "velocity-baseline");
      return;
    }

    if (activeStepId === "velocity-baseline") {
      completeStep("velocity-baseline", "slack-leaves");
      return;
    }

    if (activeStepId === "slack-leaves") {
      const imported = await importSlackLeaveConfirmations();

      if (imported) {
        completeStep("slack-leaves", "jira-close");
      }

      return;
    }

    if (activeStepId === "jira-close") {
      const closed = await runSavedConnectorAction("close-previous-sprint");

      if (closed) {
        completeStep("jira-close", "jira-reporting");
      }

      return;
    }

    if (activeStepId === "jira-reporting") {
      const pulled = await runSavedConnectorAction("fetch-closed-story-points");

      if (pulled) {
        completeStep("jira-reporting", "velocity-decision");
      }

      return;
    }

    if (activeStepId === "velocity-decision") {
      await generateDraft();
      completeStep("velocity-decision", "finalize");
      return;
    }

    const saved = await saveSession();

    if (saved) {
      completeStep("finalize");
    }
  }

  function renderStepContent() {
    if (activeStepId === "clone") {
      return (
        <>
          <SectionTitle icon={Settings2} title="Team connectors" />
          <div className="inline-actions">
            <button className="inline-action" type="button" onClick={loadTeamConfig}>
              <Settings2 size={16} aria-hidden="true" />
              Load team config
            </button>
            <button className="inline-action" type="button" onClick={saveTeamConfig}>
              <SaveIcon size={16} aria-hidden="true" />
              Save team config
            </button>
          </div>
          <div className="field-grid">
            <TextField label="Team key" value={form.teamKey} onChange={(value) => updateText("teamKey", value)} />
            <TextField label="Team" value={form.teamName} onChange={(value) => updateText("teamName", value)} />
            <TextField
              label="Team project name"
              value={form.jiraProjectName}
              onChange={(value) => updateText("jiraProjectName", value)}
            />
            <TextField
              label="Jira project key"
              value={form.jiraProjectKey}
              onChange={(value) => updateText("jiraProjectKey", value)}
            />
            <TextField
              label="Jira board"
              value={form.jiraBoardName}
              onChange={(value) => updateText("jiraBoardName", value)}
            />
            <TextField
              label="Slack channel"
              value={form.slackChannel}
              onChange={(value) => updateText("slackChannel", value)}
            />
            <TextField
              label="Sprint naming pattern"
              placeholder="Q{quarter}S{sprint} - {year}"
              value={form.sprintNamingPattern}
              onChange={(value) => updateText("sprintNamingPattern", value)}
            />
          </div>
          <div className="workflow-note">
            <strong>Saved sprint source</strong>
            <p>Use Open to choose a previous sprint session, then Clone to new sprint inside the saved-session browser.</p>
          </div>
        </>
      );
    }

    if (activeStepId === "calendar") {
      return (
        <>
          <SectionTitle icon={CalendarDays} title="Sprint calendar" />
          <div className="inline-actions">
            <button className="inline-action" type="button" onClick={clonePreviousSprint}>
              <Copy size={16} aria-hidden="true" />
              Clone previous sprint context
            </button>
            <button className="inline-action" type="button" onClick={calculateWorkingDays}>
              <CalendarDays size={16} aria-hidden="true" />
              Calculate working days
            </button>
          </div>
          <div className="field-grid">
            <TextField
              label="Previous sprint"
              value={form.previousSprintName}
              onChange={(value) => updateText("previousSprintName", value)}
            />
            <TextField
              label="Current sprint"
              value={form.currentSprintName}
              onChange={(value) => updateText("currentSprintName", value)}
            />
            <TextField
              label="Previous start"
              type="date"
              value={form.previousSprintStart}
              onChange={(value) => updateText("previousSprintStart", value)}
            />
            <TextField
              label="Previous end"
              type="date"
              value={form.previousSprintEnd}
              onChange={(value) => updateText("previousSprintEnd", value)}
            />
            <TextField
              label="Current start"
              type="date"
              value={form.currentSprintStart}
              onChange={(value) => updateText("currentSprintStart", value)}
            />
            <TextField
              label="Current end"
              type="date"
              value={form.currentSprintEnd}
              onChange={(value) => updateText("currentSprintEnd", value)}
            />
            <NumberField
              label="Days excl. holidays"
              value={form.daysInSprintExcludingHolidays}
              onChange={(value) => updateNumber("daysInSprintExcludingHolidays", value)}
            />
            <NumberField
              label="Holiday count"
              value={form.holidayCount}
              onChange={(value) => updateNumber("holidayCount", value)}
            />
            <NumberField
              label="Team members"
              value={form.teamMemberCount}
              onChange={(value) => updateNumber("teamMemberCount", value)}
            />
          </div>
        </>
      );
    }

    if (activeStepId === "velocity-baseline" || activeStepId === "jira-reporting") {
      return (
        <>
          <SectionTitle
            icon={Table2}
            title={activeStepId === "jira-reporting" ? "Closed sprint net velocity/dev" : "Net velocity/dev baseline"}
          />
          <div className="inline-actions">
            <button className="inline-action" type="button" onClick={importJiraVelocityHistory}>
              <Table2 size={16} aria-hidden="true" />
              Import Jira velocity history
            </button>
          </div>
          <VelocityHistoryTable
            rows={velocityHistory}
            teamMemberCount={form.teamMemberCount}
            onChange={updateVelocityHistory}
          />
        </>
      );
    }

    if (activeStepId === "slack-leaves") {
      return (
        <>
          <SectionTitle icon={MessageSquare} title="Slack leave confirmations" />
          <div className="inline-actions">
            <button className="inline-action" type="button" onClick={importSlackLeaveConfirmations}>
              <MessageSquare size={16} aria-hidden="true" />
              Import Slack leave confirmations
            </button>
          </div>
          <LeaveConfirmationsTable rows={leaveConfirmations} onChange={updateLeaveConfirmation} />
          <div className="workflow-note">
            <strong>Leave totals</strong>
            <p>
              Previous sprint: {form.previousSprintLeaveDays} days · Upcoming sprint: {form.upcomingSprintLeaveDays} days
            </p>
          </div>
        </>
      );
    }

    if (activeStepId === "jira-close") {
      return (
        <>
          <SectionTitle icon={ClipboardCheck} title="Close previous Jira sprint" />
          <div className="workflow-note">
            <strong>{form.previousSprintName}</strong>
            <p>Close this sprint on {form.jiraBoardName}. Mock mode records the action in this saved session only.</p>
          </div>
          <div className="preview-list">
            <p>{apiOutput?.jiraCloseReportPreview.closeSprintAction ?? `Close ${form.previousSprintName} on Jira board ${form.jiraBoardName}`}</p>
            <p>Connector action requires a saved session with no unsaved changes.</p>
          </div>
        </>
      );
    }

    if (activeStepId === "velocity-decision") {
      return (
        <>
          <SectionTitle icon={Goal} title="Net velocity/dev decision" />
          <div className="metric-grid">
            <Metric label="Average net velocity/dev" value={planning.averageNetVelocityPerDeveloper} />
            <Metric label="Capacity-adjusted net velocity/dev" value={planning.capacityAdjustedVelocityPerDeveloper} />
            <Metric
              label="Confidence-adjusted net velocity/dev"
              value={planning.confidenceAdjustedVelocityPerDeveloper}
            />
            <Metric label="Total sprint net velocity" value={planning.sprintVelocity} />
          </div>
          <div className="field-grid velocity-controls">
            <NumberField
              label="Confidence adjustment %"
              value={form.confidenceAdjustment}
              onChange={(value) => updateNumber("confidenceAdjustment", value)}
            />
            <TextField
              inputMode="decimal"
              label="Avg net velocity per developer override"
              placeholder="Optional per-dev net target"
              value={form.manualVelocityPerDeveloperOverride}
              onChange={(value) => updateText("manualVelocityPerDeveloperOverride", value)}
            />
            <TextField
              label="Override reason"
              placeholder="Confidence, low-effort spillover, or team call"
              value={form.velocityOverrideReason}
              onChange={(value) => updateText("velocityOverrideReason", value)}
            />
          </div>
          {planning.manualVelocityOverrideTotal == null ? null : (
            <div className="workflow-note derived-velocity-note">
              <strong>Total sprint net velocity derived from net velocity/dev override</strong>
              <p>
                {planning.manualVelocityPerDeveloperOverride} SP per developer × {form.teamMemberCount} developers ={" "}
                {planning.manualVelocityOverrideTotal} SP total sprint net velocity.
              </p>
            </div>
          )}
        </>
      );
    }

    return (
      <>
        <SectionTitle icon={ListChecks} title="Finalize sprint plan" />
        <label className="status-select final-status-select">
          <span>Planning status</span>
          <select
            value={planningStatus}
            onChange={(event) => {
              setPlanningStatus(event.target.value as PlanningStatus);
              markDirty();
            }}
          >
            <option value="draft">Draft</option>
            <option value="ready_for_review">Ready for review</option>
            <option value="finalized">Finalized</option>
            <option value="published">Published</option>
          </select>
        </label>
        <div className="final-review-grid">
          <article>
            <h3>Slack leave request</h3>
            <pre className="preview-box">{slackPreview}</pre>
          </article>
          <article>
            <h3>Jira close and report</h3>
            <div className="preview-list">
              <p>{apiOutput?.jiraCloseReportPreview.closeSprintAction ?? `Close ${form.previousSprintName} on Jira board ${form.jiraBoardName}`}</p>
              <p>{apiOutput?.jiraCloseReportPreview.reportingAction ?? `Fetch net velocity/dev for ${form.previousSprintName} in ${form.jiraProjectKey}`}</p>
              <p>
                Last net velocity/dev:{" "}
                {toPerDeveloperVelocity(apiOutput?.jiraCloseReportPreview.lastNetVelocity ?? form.lastNetVelocity, form.teamMemberCount)}{" "}
                ({apiOutput?.jiraCloseReportPreview.lastNetVelocity ?? form.lastNetVelocity} total)
              </p>
            </div>
          </article>
        </div>
      </>
    );
  }

  const summaryVelocity = isDirty ? planning.sprintVelocity : apiPlan?.output.sprintVelocity ?? planning.sprintVelocity;
  const summaryVelocityPerDeveloper = isDirty
    ? planning.sprintNetVelocityPerDeveloper
    : apiPlan?.output.sprintNetVelocityPerDeveloper ?? toPerDeveloperVelocity(summaryVelocity, form.teamMemberCount);
  const sessionLabel = sessionId == null ? "New planning session" : `${form.currentSprintName} saved draft`;
  const lastSavedLabel = lastSavedAt === "" ? "Not saved yet" : `Last saved ${new Date(lastSavedAt).toLocaleString()}`;
  const cloneDisabled = isDirty || isConnectorRunning;
  const connectorActionsDisabled = sessionId == null || isDirty || isConnectorRunning;
  const connectorMode = scrumMasterStatus?.sprintPlanningConnectorMode ?? "mock";
  const activeStepIndex = workflowStepDefinitions.findIndex((step) => step.id === activeStepId);
  const previousStep = workflowStepDefinitions[activeStepIndex - 1];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Bot size={22} strokeWidth={2.2} />
          </span>
          <div>
            <strong>AI CoWorkers</strong>
            <span>Scrum Master workspace</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span>{form.teamKey}</span>
          <span>{form.jiraProjectKey}</span>
          <span>{form.slackChannel}</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Coworker 01</p>
          <h1>Sprint planning without the Excel handoff.</h1>
          <p>
            This workbench turns the current SM flow into a Jira-first workflow: clone sprint context, collect
            leaves, close the previous sprint, pull net velocity/dev, and calculate team-approved net velocity per developer.
          </p>
        </div>
        <aside className="velocity-panel" aria-label="Sprint net velocity per developer output">
          <span className="panel-kicker">Net velocity/dev</span>
          <strong>{summaryVelocityPerDeveloper}</strong>
          <p>
            {planning.velocitySource} for {form.currentSprintName} · {summaryVelocity} total net velocity
          </p>
          <button type="button" onClick={generateDraft}>
            <Sparkles size={18} />
            Generate SM workflow
          </button>
          <small aria-live="polite">{draftStatus}</small>
        </aside>
      </section>

      {viewMode === "home" ? (
        <section className="sprint-home" aria-labelledby="sprint-home-title">
          <div className="sprint-home-header">
            <div>
              <span className="panel-kicker">Sprint planner coworker</span>
              <h2 id="sprint-home-title">Sprint plans</h2>
              <p>Resume an in-progress sprint plan, review finalized plans, or start the next planning workflow.</p>
            </div>
            <div className="sprint-home-actions">
              <button type="button" onClick={() => refreshSavedSessions("Refreshing sprint planning sessions...")}>
                <History size={16} aria-hidden="true" />
                Refresh
              </button>
              <button className="primary-home-action" type="button" onClick={startNewPlanningSession}>
                <Plus size={16} aria-hidden="true" />
                Start sprint plan
              </button>
            </div>
          </div>

          <div className="sprint-home-grid">
            <article className="sprint-home-summary">
              <SectionTitle icon={Settings2} title="Team setup" />
              <dl>
                <div>
                  <dt>Team</dt>
                  <dd>{form.teamName}</dd>
                </div>
                <div>
                  <dt>Project</dt>
                  <dd>{form.jiraProjectName || form.jiraProjectKey}</dd>
                </div>
                <div>
                  <dt>Pattern</dt>
                  <dd>{form.sprintNamingPattern}</dd>
                </div>
                <div>
                  <dt>Connectors</dt>
                  <dd>{connectorMode}</dd>
                </div>
              </dl>
            </article>

            <div className="sprint-home-list" aria-label="Saved sprint plans">
              {savedSessions.length === 0 ? (
                <div className="empty-sprint-list">
                  <FolderOpen size={34} aria-hidden="true" />
                  <strong>No sprint plans saved yet</strong>
                  <p>Start a sprint plan and save it once to make it available here for resume and review.</p>
                  <button type="button" onClick={startNewPlanningSession}>
                    <Plus size={16} aria-hidden="true" />
                    Start sprint plan
                  </button>
                </div>
              ) : (
                savedSessions.map((session) => (
                  <article className="sprint-plan-card" key={session.sessionId}>
                    <div className="sprint-plan-main">
                      <span className={`planning-status-pill ${session.planningStatus}`}>
                        {session.planningStatus.replaceAll("_", " ")}
                      </span>
                      <h3>{session.currentSprintName}</h3>
                      <p>
                        {session.currentSprintDates.start} to {session.currentSprintDates.end} · cloned from{" "}
                        {session.previousSprintName}
                      </p>
                    </div>
                    <div className="sprint-plan-metrics">
                      <span>
                        <strong>{session.sprintVelocityPerDeveloper}</strong>
                        net velocity/dev
                      </span>
                      <span>
                        <strong>{session.sprintVelocity}</strong>
                        total net velocity
                      </span>
                      <span>
                        <strong>{session.pendingLeaveConfirmations}</strong>
                        pending leaves
                      </span>
                    </div>
                    <div className="sprint-plan-footer">
                      <small>Updated {formatSavedAt(session.updatedAt)}</small>
                      <div>
                        <button type="button" onClick={() => loadSession(session.sessionId)}>
                          <FolderOpen size={16} aria-hidden="true" />
                          {session.planningStatus === "published" || session.planningStatus === "finalized"
                            ? "Review"
                            : "Continue"}
                        </button>
                        <button type="button" onClick={() => cloneSavedSession(session.sessionId)}>
                          <Copy size={16} aria-hidden="true" />
                          Clone next
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
      <section className="session-strip" aria-label="Saved sprint planning session">
        <div>
          <span className="panel-kicker">Session</span>
          <strong>{sessionLabel}</strong>
          <small>
            {planningStatus.replaceAll("_", " ")} · {isDirty ? "Unsaved changes" : lastSavedLabel}
          </small>
        </div>
        <label className="status-select">
          <span>Planning status</span>
          <select
            value={planningStatus}
            onChange={(event) => {
              setPlanningStatus(event.target.value as PlanningStatus);
              markDirty();
            }}
          >
            <option value="draft">Draft</option>
            <option value="ready_for_review">Ready for review</option>
            <option value="finalized">Finalized</option>
            <option value="published">Published</option>
          </select>
        </label>
        <div className="session-actions">
          <button
            type="button"
            onClick={() => {
              void refreshSavedSessions("Refreshing sprint planning sessions...");
              setViewMode("home");
            }}
            disabled={isConnectorRunning}
          >
            <History size={16} />
            Sprint list
          </button>
          <button className="primary-session-action" type="button" onClick={saveSession} disabled={isConnectorRunning}>
            <SaveIcon size={16} />
            Save
          </button>
          <button type="button" onClick={openSessionBrowser} disabled={isConnectorRunning}>
            <FolderOpen size={16} />
            Open
          </button>
        </div>
        <div className="session-connector-actions">
          <div>
            <span className="panel-kicker">Connector actions</span>
            <small>
              {sessionId == null
                ? "Save this planning session before running connectors."
                : isDirty
                  ? "Save changes to run connectors against the latest saved session."
                  : "Run mock connector actions now; Jira and Slack API/MCP adapters can replace these later."}
            </small>
          </div>
          <div className="connector-action-buttons">
            <button
              type="button"
              disabled={connectorActionsDisabled}
              onClick={() => runSavedConnectorAction("close-previous-sprint")}
            >
              <ClipboardCheck size={16} />
              Close Jira sprint
            </button>
            <button
              type="button"
              disabled={connectorActionsDisabled}
              onClick={() => runSavedConnectorAction("fetch-closed-story-points")}
            >
              <Table2 size={16} />
              Jira net velocity/dev
            </button>
            <button
              type="button"
              disabled={connectorActionsDisabled}
              onClick={() => runSavedConnectorAction("collect-leaves")}
            >
              <MessageSquare size={16} />
              Slack leaves
            </button>
            <button type="button" disabled={connectorActionsDisabled} onClick={runSavedConnectorWorkflow}>
              <Sparkles size={16} />
              Run planning connectors
            </button>
          </div>
        </div>
      </section>

      {isSessionBrowserOpen ? (
        <section className="session-browser" aria-labelledby="session-browser-title">
          <div className="session-browser-header">
            <div>
              <span className="panel-kicker">Saved sessions</span>
              <h2 id="session-browser-title">Open or clone sprint planning session</h2>
            </div>
            <button type="button" onClick={() => setIsSessionBrowserOpen(false)}>
              Close
            </button>
          </div>
          <div className="session-list">
            {savedSessions.length === 0 ? (
              <p>No saved sprint planning sessions for {form.teamKey} yet.</p>
            ) : (
              savedSessions.map((session) => (
                <article className="session-list-row" key={session.sessionId}>
                  <span>
                    <strong>{session.currentSprintName}</strong>
                    <small>
                      {session.currentSprintDates.start} to {session.currentSprintDates.end} · from{" "}
                      {session.previousSprintName}
                    </small>
                  </span>
                  <span className="session-meta">
                    <small>{session.planningStatus.replaceAll("_", " ")}</small>
                    <strong>
                      {session.sprintVelocityPerDeveloper} net velocity/dev · {session.sprintVelocity} total
                    </strong>
                    <small>
                      {session.pendingLeaveConfirmations} pending leaves · {session.connectorPendingSteps} connector
                      steps
                    </small>
                  </span>
                  <span className="session-row-actions">
                    <button type="button" onClick={() => loadSession(session.sessionId)}>
                      <FolderOpen size={16} />
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => cloneSavedSession(session.sessionId)}
                      disabled={cloneDisabled}
                    >
                      <Copy size={16} />
                      Clone to new sprint
                    </button>
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      <Tabs.Root className="workflow-grid" value={activeStepId} onValueChange={(value) => navigateWorkflowStep(value as WorkflowStepId)}>
        <Tabs.List className="workflow-stepper" aria-label="Sprint planning workflow">
          {workflowStepDefinitions.map((step, index) => {
            const state = getWorkflowStepState(step.id);
            const isLocked = state === "locked";

            return (
              <Tabs.Trigger className={`workflow-step ${state}`} disabled={isLocked} key={step.id} value={step.id}>
                <span className="workflow-step-index">{index + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>
                    {state === "completed"
                      ? "Completed"
                      : state === "current"
                        ? "In progress"
                        : state === "available"
                          ? "Available"
                          : "Locked"}
                  </small>
                </span>
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        <Tabs.Content className="workflow-editor" value={activeStepId} asChild>
          <form>
            <div className="workflow-editor-header">
              <div>
                <span className="panel-kicker">Step {activeStepIndex + 1}</span>
                <h2>{activeStep.title}</h2>
                <p>{activeStep.description}</p>
              </div>
              {activeStep.connector ? (
                <span className={`connector-mode-badge ${activeStep.connector}`}>Mock {activeStep.connector}</span>
              ) : null}
            </div>

            {renderStepContent()}

            <div className="workflow-actions">
              <button
                className="secondary-action"
                disabled={!previousStep}
                onClick={() => previousStep && setActiveStepId(previousStep.id)}
                type="button"
              >
                Back
              </button>
              {activeStepId !== "finalize" ? (
                <button className="secondary-action" onClick={() => skipStep(activeStepId)} type="button">
                  Skip for now
                </button>
              ) : null}
              <button
                className="primary-action"
                disabled={
                  isConnectorRunning ||
                  (activeStepId === "jira-close" && connectorActionsDisabled) ||
                  (activeStepId === "jira-reporting" && connectorActionsDisabled)
                }
                onClick={runActiveStepPrimaryAction}
                type="button"
              >
                {activeStep.primaryAction}
              </button>
            </div>
          </form>
        </Tabs.Content>

        <aside className="workflow-summary">
          <article className="output-card velocity-summary-card">
            <SectionTitle icon={Goal} title="Net velocity per developer" />
            <div className="final-metric">
              <span>Final net velocity/dev</span>
              <strong>{summaryVelocityPerDeveloper}</strong>
            </div>
            <Metric label="Total sprint net velocity" value={summaryVelocity} />
            <Metric label="Average net velocity/dev" value={planning.averageNetVelocityPerDeveloper} />
            <Metric label="Available capacity days" value={planning.availableCapacityDays} />
            <Metric label="Capacity-adjusted net velocity/dev" value={planning.capacityAdjustedVelocityPerDeveloper} />
          </article>

          <article className="output-card">
            <SectionTitle icon={ClipboardCheck} title="Connector status" />
            <div className="connector-status-grid">
              <span>Mode</span>
              <strong>{connectorMode}</strong>
              <span>Jira</span>
              <strong>Mock only</strong>
              <span>Slack</span>
              <strong>Mock only</strong>
            </div>
            <p className="connector-status-note">Mock actions update this saved session only. They do not change Jira or Slack.</p>
          </article>

          <article className="output-card">
            <SectionTitle icon={ListChecks} title="Workflow status" />
            <div className="step-list">
              {workflowChecklist.map((step) => (
                <div className="step-row" key={step.id}>
                  <span className={`step-status ${step.status}`}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <p>{step.label}</p>
                    <small>
                      {"owner" in step ? `${step.owner} · ` : ""}
                      {statusLabels[step.status as AutomationStep["status"]] ?? step.status}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="output-card">
            <SectionTitle icon={MessageSquare} title="Slack preview" />
            <pre className="preview-box">{slackPreview}</pre>
          </article>
        </aside>
      </Tabs.Root>
        </>
      )}
    </main>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="section-title">
      <span>
        <Icon size={18} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
    </div>
  );
}

function VelocityHistoryTable({
  rows,
  teamMemberCount,
  onChange
}: {
  rows: VelocityHistoryRow[];
  teamMemberCount: number;
  onChange: (
    sprintOffset: VelocityHistoryRow["sprintOffset"],
    field: keyof Pick<VelocityHistoryRow, "netVelocity">,
    value: string
  ) => void;
}) {
  return (
    <div className="velocity-history" aria-describedby="velocity-history-help">
      <table>
        <caption>Velocity history used for average</caption>
        <thead>
          <tr>
            <th scope="col">Sprint</th>
            <th scope="col">Net velocity/dev</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sprintOffset}>
              <th scope="row">
                <span>{row.sprintOffset === -1 ? "Last closed sprint" : `${Math.abs(row.sprintOffset)} sprints ago`}</span>
                <small>
                  {row.sprintName} · {toPerDeveloperVelocity(row.netVelocity, teamMemberCount)} net velocity/dev ·{" "}
                  {row.netVelocity} total net velocity · {row.completedStoryPoints} completed SP · {row.leaveDays} leave days ·{" "}
                  <SourcePill source={row.source} />
                </small>
              </th>
              <td>
                <input
                  aria-label={`Net velocity per developer for ${row.sprintOffset === -1 ? "last closed sprint" : `${Math.abs(row.sprintOffset)} sprints ago`}`}
                  min="0"
                  onChange={(event) =>
                    onChange(row.sprintOffset, "netVelocity", String(toNumber(event.target.value) * teamMemberCount))
                  }
                  step="0.5"
                  type="number"
                  value={toPerDeveloperVelocity(row.netVelocity, teamMemberCount)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p id="velocity-history-help">
        Average is calculated from the three sprint net velocity/dev values. Jira import updates the last closed sprint
        net velocity/dev before the SM finalizes the override.
      </p>
    </div>
  );
}

function LeaveConfirmationsTable({
  rows,
  onChange
}: {
  rows: LeaveConfirmationRow[];
  onChange: (
    slackUserId: string,
    field: keyof Pick<LeaveConfirmationRow, "previousSprintLeaveDays" | "upcomingSprintLeaveDays">,
    value: string
  ) => void;
}) {
  return (
    <div className="leave-confirmations" aria-describedby="leave-confirmations-help">
      <table>
        <caption>Slack leave confirmations</caption>
        <thead>
          <tr>
            <th scope="col">Teammate</th>
            <th scope="col">Previous sprint</th>
            <th scope="col">Upcoming sprint</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slackUserId}>
              <th scope="row">
                <span>{row.teammateName}</span>
                <small>
                  {row.confirmationStatus.replaceAll("_", " ")} · <SourcePill source={row.source} />
                </small>
              </th>
              <td>
                <input
                  aria-label={`Previous sprint leave days for ${row.teammateName}`}
                  min="0"
                  onChange={(event) => onChange(row.slackUserId, "previousSprintLeaveDays", event.target.value)}
                  step="0.5"
                  type="number"
                  value={row.previousSprintLeaveDays}
                />
              </td>
              <td>
                <input
                  aria-label={`Upcoming sprint leave days for ${row.teammateName}`}
                  min="0"
                  onChange={(event) => onChange(row.slackUserId, "upcomingSprintLeaveDays", event.target.value)}
                  step="0.5"
                  type="number"
                  value={row.upcomingSprintLeaveDays}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p id="leave-confirmations-help">
        Table totals update the previous and upcoming sprint leave days used in capacity and Slack previews.
      </p>
    </div>
  );
}

function SourcePill({ source }: { source: VelocityHistoryRow["source"] | LeaveConfirmationRow["source"] }) {
  const label =
    source === "mock-jira-report"
      ? "Mock Jira"
      : source === "jira_report"
        ? "Real Jira"
        : source === "mock-slack-thread"
          ? "Mock Slack"
          : source === "slack_thread"
            ? "Real Slack"
            : "Manual";

  return <span className={`source-pill ${source}`}>{label}</span>;
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode={inputMode}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input min="0" step="0.5" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
