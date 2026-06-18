import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppShell,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Menu,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Table,
  Text,
  Textarea,
  TextInput,
  Title
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMediaQuery } from "@mantine/hooks";
import {
  Bot,
  CalendarDays,
  ClipboardCheck,
  Copy,
  FolderOpen,
  Goal,
  History,
  ListChecks,
  MessageSquare,
  Plus,
  Save as SaveIcon,
  Search,
  Settings2,
  Sparkles,
  Table2,
  UserRound
} from "lucide-react";
import {
  cloneSprintPlanningSession,
  createSprintPlanningWorkflowDraft,
  getJiraVelocityHistory,
  getScrumMasterStatus,
  getSprintPlanningSession,
  getSprintPlanningTeamConfig,
  listSprintPlanningSessions,
  runSprintPlanningConnectorAction,
  saveSprintPlanningSession,
  saveSprintPlanningTeamConfig
} from "./sprintPlanningApi";
import { calculatePlanning, toNumber, toSprintPlanningInput } from "./sprintPlanningCalculations";
import {
  formatSavedAt,
  LeaveConfirmationEditor,
  MetricBlock,
  SectionHeading,
  SprintPlanCard,
  toPerDeveloperVelocity,
  VelocityHistoryEditor,
  WorkflowStepper,
  WorkflowSummary
} from "./SprintPlannerComponents";
import type { WorkflowStepDefinition } from "./SprintPlannerComponents";
import type {
  AutomationStep,
  DraftResponse,
  LeaveConfirmationRow,
  PlanningForm,
  PlanningStatus,
  SavedSprintPlanningSession,
  SavedSprintPlanningSessionSummary,
  ScrumMasterStatusResponse,
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
    label: "Prepare a manual leave request and update previous/upcoming sprint leave rows.",
    owner: "Scrum Master",
    status: "team-input"
  },
  {
    id: "jira-close",
    label: "Open Jira and manually close the previous sprint before velocity import.",
    owner: "Scrum Master",
    status: "team-input"
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

const workflowStepDefinitions: WorkflowStepDefinition[] = [
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
    id: "slack-leaves",
    title: "Confirm leave updates",
    description: "Edit a manual leave request draft, then update each teammate row before capacity is recalculated.",
    primaryAction: "Confirm leave rows"
  },
  {
    id: "jira-close",
    title: "Close Jira sprint",
    description: "Open Jira and close the previous sprint manually. The app stays read-only against Jira.",
    primaryAction: "I closed it in Jira",
    connector: "jira"
  },
  {
    id: "jira-reporting",
    title: "Pull Jira velocity history",
    description: "After the previous sprint is closed, pull and edit the -3, -2, and final -1 net velocity/dev values.",
    primaryAction: "Pull Jira velocity history",
    connector: "jira"
  },
  {
    id: "velocity-decision",
    title: "Calculate net velocity/dev and override",
    description: "Review the calculated net velocity per developer and apply a team-approved override.",
    primaryAction: "Finalize net velocity/dev"
  },
  {
    id: "finalize",
    title: "Finalize sprint plan",
    description: "Save the session, set review status, and inspect leave/Jira previews before publishing later.",
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

function createSlackLeaveRequestMessage(form: PlanningForm) {
  return [
    `Hi team, please confirm leave updates for ${form.previousSprintName} and ${form.currentSprintName}.`,
    "",
    "Please reply with:",
    `- previous sprint leave corrections for ${form.previousSprintName}`,
    `- planned leave days for ${form.currentSprintName}`,
    "",
    "Format example: previous 0.5, upcoming 1. I will update the planning workflow manually before finalizing net velocity/dev."
  ].join("\n");
}

function toPerDeveloperOverride(input: SprintPlanningInput) {
  if (input.manualVelocityOverride == null || input.teamMemberCount <= 0) {
    return "";
  }

  return String(Math.round((input.manualVelocityOverride / input.teamMemberCount) * 10) / 10);
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

function numberInputValue(value: string | number) {
  return String(value ?? "");
}

function createJiraSprintSearchUrl(form: PlanningForm) {
  const jql = `project = ${form.jiraProjectKey} AND sprint = "${form.previousSprintName}"`;

  return `https://agoda.atlassian.net/issues/?jql=${encodeURIComponent(jql)}`;
}

function formatValue(value: number) {
  return Math.round(value * 10) / 10;
}

function calculateTargetRows(
  leaveRows: LeaveConfirmationRow[],
  form: PlanningForm,
  targetVelocity: number
) {
  const rawRows = leaveRows.map((row) => ({
    ...row,
    previousDevDays: Math.max(countWeekdays(form.previousSprintStart, form.previousSprintEnd) - row.previousSprintLeaveDays, 0),
    currentDevDays: Math.max(form.daysInSprintExcludingHolidays - row.upcomingSprintLeaveDays, 0)
  }));
  const totalCurrentDevDays = rawRows.reduce((sum, row) => sum + row.currentDevDays, 0);

  return rawRows.map((row) => ({
    ...row,
    targetPoints:
      totalCurrentDevDays > 0 ? formatValue((row.currentDevDays / totalCurrentDevDays) * targetVelocity) : 0
  }));
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
  const [isTeamProfileOpen, setIsTeamProfileOpen] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [slackLeaveMessageDraft, setSlackLeaveMessageDraft] = useState(() =>
    createSlackLeaveRequestMessage(initialForm)
  );
  const [leaveReviewStatus, setLeaveReviewStatus] = useState("No Slack connector is configured; edit leave rows manually");
  const mobileStepper = useMediaQuery("(max-width: 48em)") ?? false;
  const planning = useMemo(() => calculatePlanning(form), [form]);
  const apiOutput = apiPlan?.output;
  const workflowChecklist = apiOutput?.checklist ?? workflowSteps;
  const slackPreview = slackLeaveMessageDraft;
  const activeStep = workflowStepDefinitions.find((step) => step.id === activeStepId) ?? workflowStepDefinitions[0];
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
  const visibleSavedSessions = useMemo(() => {
    const search = sessionSearch.trim().toLowerCase();

    return savedSessions.filter((session) => {
      const matchesSearch =
        search === "" ||
        session.currentSprintName.toLowerCase().includes(search) ||
        session.previousSprintName.toLowerCase().includes(search) ||
        session.teamName.toLowerCase().includes(search);

      return matchesSearch;
    });
  }, [savedSessions, sessionSearch]);

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

  function updateTeamMember(index: number, field: "teammateName" | "slackUserId", value: string) {
    setLeaveConfirmations((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value, source: "manual" } : row))
    );
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
      setDraftStatus("Team connector config saved for current environment");
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

  function clonePreviousSprint() {
    setForm((current) => {
      const nextForm = {
        ...current,
        currentSprintName: nextSprintName(current.previousSprintName, current.sprintNamingPattern),
        currentSprintStart: addDays(current.previousSprintStart, 14),
        currentSprintEnd: addDays(current.previousSprintEnd, 14),
        previousVelocityMinus3: current.previousVelocityMinus2,
        previousVelocityMinus2: current.lastNetVelocity
      };

      setSlackLeaveMessageDraft(createSlackLeaveRequestMessage(nextForm));
      setLeaveReviewStatus("No Slack connector is configured; edit leave rows manually");

      return nextForm;
    });
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
    const nextForm = toPlanningForm(session.input);

    setForm((current) => ({
      ...nextForm,
      jiraProjectName: current.jiraProjectName,
      sprintNamingPattern: current.sprintNamingPattern
    }));
    setSlackLeaveMessageDraft(createSlackLeaveRequestMessage(nextForm));
    setLeaveReviewStatus("No Slack connector is configured; edit leave rows manually");
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
      "fetch-closed-story-points": "Importing saved-session Jira net velocity/dev..."
    };
    const successMessages: Record<SprintPlanningConnectorActionKey, string> = {
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
      completeStep("calendar", "slack-leaves");
      return;
    }

    if (activeStepId === "slack-leaves") {
      setLeaveReviewStatus("Leave rows confirmed manually; no Slack connector was run");
      setDraftStatus("Manual leave rows confirmed; continue to Jira closure");
      completeStep("slack-leaves", "jira-close");
      return;
    }

    if (activeStepId === "jira-close") {
      completeStep("jira-close", "jira-reporting");
      setDraftStatus("Previous sprint marked as manually closed; pull Jira velocity history next");
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
        <Stack gap="lg">
          <SectionHeading
            icon={FolderOpen}
            title="Sprint source"
            description="Start from the current team context and clone a saved sprint plan when needed."
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                  Selected team
                </Text>
                <Title order={3} size="h4">
                  {form.teamName}
                </Title>
                <InfoRow label="Project" value={form.jiraProjectName || form.jiraProjectKey} />
                <InfoRow label="Jira board" value={form.jiraBoardName} />
                <InfoRow label="Sprint pattern" value={form.sprintNamingPattern} />
              </Stack>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                  Current active sprint
                </Text>
                <Title order={3} size="h4">
                  {form.currentSprintName}
                </Title>
                <InfoRow label="Dates" value={`${form.currentSprintStart} to ${form.currentSprintEnd}`} />
                <InfoRow label="Previous sprint" value={form.previousSprintName} />
                <InfoRow label="Source" value="Jira active sprint later; editable now" />
              </Stack>
            </Paper>
          </SimpleGrid>
          <Alert variant="light" color="teal" title="Team config is central">
            Manage team membership, Jira project defaults, and sprint naming from the Teams tab. Use Open to choose a
            previous sprint session, then Clone to create the next sprint from saved context.
          </Alert>
        </Stack>
      );
    }

    if (activeStepId === "calendar") {
      return (
        <Stack gap="lg">
          <SectionHeading icon={CalendarDays} title="Sprint calendar" />
          <Group gap="xs">
            <Button variant="default" leftSection={<Copy size={16} />} onClick={clonePreviousSprint}>
              Clone previous sprint context
            </Button>
            <Button variant="light" leftSection={<CalendarDays size={16} />} onClick={calculateWorkingDays}>
              Calculate working days
            </Button>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Previous sprint"
              value={form.previousSprintName}
              onChange={(event) => updateText("previousSprintName", event.currentTarget.value)}
            />
            <TextInput
              label="Current sprint"
              value={form.currentSprintName}
              onChange={(event) => updateText("currentSprintName", event.currentTarget.value)}
            />
            <DateInput
              label="Previous start"
              value={form.previousSprintStart}
              valueFormat="YYYY-MM-DD"
              onChange={(value) => updateText("previousSprintStart", value ?? "")}
            />
            <DateInput
              label="Previous end"
              value={form.previousSprintEnd}
              valueFormat="YYYY-MM-DD"
              onChange={(value) => updateText("previousSprintEnd", value ?? "")}
            />
            <DateInput
              label="Current start"
              value={form.currentSprintStart}
              valueFormat="YYYY-MM-DD"
              onChange={(value) => updateText("currentSprintStart", value ?? "")}
            />
            <DateInput
              label="Current end"
              value={form.currentSprintEnd}
              valueFormat="YYYY-MM-DD"
              onChange={(value) => updateText("currentSprintEnd", value ?? "")}
            />
            <NumberInput
              label="Days excluding holidays"
              min={0}
              value={form.daysInSprintExcludingHolidays}
              onChange={(value) => updateNumber("daysInSprintExcludingHolidays", numberInputValue(value))}
            />
            <NumberInput
              label="Holiday count"
              min={0}
              value={form.holidayCount}
              onChange={(value) => updateNumber("holidayCount", numberInputValue(value))}
            />
            <NumberInput
              label="Team members"
              min={1}
              value={form.teamMemberCount}
              onChange={(value) => updateNumber("teamMemberCount", numberInputValue(value))}
            />
          </SimpleGrid>
        </Stack>
      );
    }

    if (activeStepId === "jira-reporting") {
      return (
        <Stack gap="lg">
          <SectionHeading icon={Table2} title="Jira velocity history" />
          <Alert color="blue" variant="light" title="Update velocity after sprint closure">
            This is the single velocity update step. After the previous sprint is closed, pull Jira reporting and edit
            the -3, -2, and final -1 net velocity/dev values in one place before the velocity decision.
          </Alert>
          <Group gap="xs">
            <Button variant="light" leftSection={<Table2 size={16} />} onClick={importJiraVelocityHistory}>
              Import Jira velocity history
            </Button>
          </Group>
          <VelocityHistoryEditor
            rows={velocityHistory}
            teamMemberCount={form.teamMemberCount}
            onChange={updateVelocityHistory}
          />
          <Text size="sm" c="dimmed">
            The final -1 row should reflect completed story points after closing {form.previousSprintName}. The -3 and
            -2 rows remain editable in case Jira reporting or spillover context needs correction.
          </Text>
        </Stack>
      );
    }

    if (activeStepId === "slack-leaves") {
      return (
        <Stack gap="lg">
          <SectionHeading icon={MessageSquare} title="Manual leave confirmations" />
          <Alert color="blue" variant="light" title="Slack connector disabled">
            The app does not send Slack messages or read Slack threads. Edit the request draft, post or follow up
            manually in {form.slackChannel}, then update the leave rows before continuing.
          </Alert>
          <Textarea
            label="Manual leave request draft"
            description={`Manual channel context: ${form.slackChannel}`}
            value={slackLeaveMessageDraft}
            onChange={(event) => {
              setSlackLeaveMessageDraft(event.currentTarget.value);
              setLeaveReviewStatus("Draft edited; update leave rows manually after replies");
              markDirty();
            }}
            autosize
            minRows={7}
          />
          <Group gap="xs">
            <Button
              variant="default"
              onClick={() => {
                setSlackLeaveMessageDraft(createSlackLeaveRequestMessage(form));
                setLeaveReviewStatus("Draft regenerated; update leave rows manually after replies");
                markDirty();
              }}
            >
              Regenerate message
            </Button>
          </Group>
          <Text size="sm" c="dimmed" aria-live="polite">
            {leaveReviewStatus}
          </Text>
          <LeaveConfirmationEditor rows={leaveConfirmations} onChange={updateLeaveConfirmation} />
          <Alert color="blue" variant="light" title="Leave totals">
            Previous sprint: {form.previousSprintLeaveDays} days. Upcoming sprint: {form.upcomingSprintLeaveDays} days.
          </Alert>
        </Stack>
      );
    }

    if (activeStepId === "jira-close") {
      const jiraSprintUrl = createJiraSprintSearchUrl(form);

      return (
        <Stack gap="lg">
          <SectionHeading icon={ClipboardCheck} title="Close previous Jira sprint" />
          <Alert color="yellow" variant="light" title="Manual Jira action">
            The app will not close sprints or write to Jira. Open the previous sprint in Jira, close it there, then come
            back and continue to pull closed-sprint velocity history.
          </Alert>
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Text fw={700}>{form.previousSprintName}</Text>
              <Text size="sm" c="dimmed">
                Board: {form.jiraBoardName} · Project: {form.jiraProjectKey}
              </Text>
              <Anchor href={jiraSprintUrl} target="_blank" rel="noreferrer" size="sm" fw={700}>
                Open previous sprint in Jira
              </Anchor>
              <Text size="sm" c="dimmed">
                After closing the sprint in Jira, use the primary action below to move to Jira velocity history import.
              </Text>
            </Stack>
          </Paper>
        </Stack>
      );
    }

    if (activeStepId === "velocity-decision") {
      return (
        <Stack gap="lg">
          <SectionHeading icon={Goal} title="Net velocity/dev decision" />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <MetricBlock label="Average net velocity/dev" value={planning.averageNetVelocityPerDeveloper} />
            <MetricBlock label="Capacity-adjusted net velocity/dev" value={planning.capacityAdjustedVelocityPerDeveloper} />
            <MetricBlock label="Confidence-adjusted net velocity/dev" value={planning.confidenceAdjustedVelocityPerDeveloper} />
            <MetricBlock label="Total sprint net velocity" value={planning.sprintVelocity} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <NumberInput
              label="Confidence adjustment %"
              value={form.confidenceAdjustment}
              onChange={(value) => updateNumber("confidenceAdjustment", numberInputValue(value))}
            />
            <NumberInput
              label="Avg net velocity per developer override"
              placeholder="Optional per-dev net target"
              min={0}
              step={0.5}
              value={form.manualVelocityPerDeveloperOverride}
              onChange={(value) => updateText("manualVelocityPerDeveloperOverride", numberInputValue(value))}
            />
            <Textarea
              label="Override reason"
              placeholder="Confidence, low-effort spillover, or team call"
              value={form.velocityOverrideReason}
              onChange={(event) => updateText("velocityOverrideReason", event.currentTarget.value)}
              autosize
              minRows={2}
            />
          </SimpleGrid>
          {planning.manualVelocityOverrideTotal == null ? null : (
            <Alert color="teal" variant="light" title="Total sprint net velocity derived from net velocity/dev override">
              {planning.manualVelocityPerDeveloperOverride} SP per developer x {form.teamMemberCount} developers ={" "}
              {planning.manualVelocityOverrideTotal} SP total sprint net velocity.
            </Alert>
          )}
        </Stack>
      );
    }

    const targetRows = calculateTargetRows(leaveConfirmations, form, summaryVelocity);
    const previousWorkingDays = countWeekdays(form.previousSprintStart, form.previousSprintEnd);
    const previousCompletedPoints =
      velocityHistory.find((row) => row.sprintOffset === -1)?.completedStoryPoints ?? form.lastNetVelocity;
    const previousTotalLeaveDays = targetRows.reduce((sum, row) => sum + row.previousSprintLeaveDays, 0);
    const previousTotalDevDays = targetRows.reduce((sum, row) => sum + row.previousDevDays, 0);
    const upcomingTotalLeaveDays = targetRows.reduce((sum, row) => sum + row.upcomingSprintLeaveDays, 0);
    const upcomingTotalTargetPoints = targetRows.reduce((sum, row) => sum + row.targetPoints, 0);

    return (
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" gap="md">
          <SectionHeading
            icon={ListChecks}
            title="Sprint planning summary"
            description="Sheet-style final review before the plan is saved."
          />
          <Paper withBorder radius="md" p="sm" w={{ base: "100%", sm: 300 }}>
            <Text size="xs" c="dimmed" fw={800} tt="uppercase">
              Active sprint context
            </Text>
            <Text fw={800}>{form.currentSprintName}</Text>
            <Text size="sm" c="dimmed">
              {form.teamName} · one current sprint per team
            </Text>
          </Paper>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
          <MetricBlock label="Final net velocity/dev" value={summaryVelocityPerDeveloper} dominant />
          <MetricBlock label="Total sprint net velocity" value={summaryVelocity} />
          <MetricBlock label="Available dev days" value={planning.availableCapacityDays} />
          <MetricBlock label="Manual leave days" value={previousTotalLeaveDays + upcomingTotalLeaveDays} />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Paper withBorder radius="md" p="md" className="sheet-summary-panel">
            <Group justify="space-between" align="flex-start" gap="md">
              <Box>
                <Title order={3} size="h4">
                  Previous Sprint Capacity Calculator
                </Title>
                <Text size="sm" c="dimmed">
                  {form.previousSprintName} · {form.previousSprintStart} to {form.previousSprintEnd}
                </Text>
              </Box>
              <Badge color="teal" variant="light">
                Done
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" mt="md">
              <MetricBlock label="Days in sprint" value={previousWorkingDays} />
              <MetricBlock label="Completed points" value={previousCompletedPoints} />
              <MetricBlock label="Total OOO days" value={previousTotalLeaveDays} />
              <MetricBlock label="Total dev days" value={formatValue(previousTotalDevDays)} />
            </SimpleGrid>
            <Table mt="md" verticalSpacing="xs" striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Engineer</Table.Th>
                  <Table.Th>Allocation</Table.Th>
                  <Table.Th>OOO days</Table.Th>
                  <Table.Th>Dev days</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {targetRows.map((row) => (
                  <Table.Tr key={`previous-${row.slackUserId}`}>
                    <Table.Td>{row.teammateName}</Table.Td>
                    <Table.Td>1</Table.Td>
                    <Table.Td>{row.previousSprintLeaveDays}</Table.Td>
                    <Table.Td>{formatValue(row.previousDevDays)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          <Paper withBorder radius="md" p="md" className="sheet-summary-panel">
            <Group justify="space-between" align="flex-start" gap="md">
              <Box>
                <Title order={3} size="h4">
                  Next Sprint Capacity Calculator
                </Title>
                <Text size="sm" c="dimmed">
                  {form.currentSprintName} · {form.currentSprintStart} to {form.currentSprintEnd}
                </Text>
              </Box>
              <Badge color="blue" variant="light">
                Planned
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" mt="md">
              <MetricBlock label="Days excl. holidays" value={form.daysInSprintExcludingHolidays} />
              <MetricBlock label="Avg net velocity/dev" value={planning.averageNetVelocityPerDeveloper} />
              <MetricBlock label="Adjustment factor" value={formatValue(1 + form.confidenceAdjustment / 100)} />
              <MetricBlock label="Sprint capacity" value={formatValue(upcomingTotalTargetPoints)} />
            </SimpleGrid>
            <Table mt="md" verticalSpacing="xs" striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Engineer</Table.Th>
                  <Table.Th>Allocation</Table.Th>
                  <Table.Th>OOO days</Table.Th>
                  <Table.Th>Target points</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {targetRows.map((row) => (
                  <Table.Tr key={`current-${row.slackUserId}`}>
                    <Table.Td>{row.teammateName}</Table.Td>
                    <Table.Td>1</Table.Td>
                    <Table.Td>{row.upcomingSprintLeaveDays}</Table.Td>
                    <Table.Td>{row.targetPoints}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <Paper withBorder radius="md" p="md">
            <Title order={3} size="h4">
              Net velocity baseline
            </Title>
            <Stack gap="xs" mt="md">
              {velocityHistory.map((row) => (
                <Group key={row.sprintOffset} justify="space-between" gap="md" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    {row.sprintOffset === -1 ? "Last net velocity" : `${Math.abs(row.sprintOffset)} sprint back`}
                  </Text>
                  <Text fw={750}>
                    {toPerDeveloperVelocity(row.netVelocity, form.teamMemberCount)} /dev ({row.netVelocity} total)
                  </Text>
                </Group>
              ))}
              <Group justify="space-between" gap="md" wrap="nowrap">
                <Text size="sm" c="dimmed">
                  Average velocity
                </Text>
                <Text fw={750}>{planning.averageNetVelocityPerDeveloper} /dev</Text>
              </Group>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Title order={3} size="h4">
              Holiday / event context
            </Title>
            <Stack gap="xs" mt="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Holiday count
                </Text>
                <Text fw={750}>{form.holidayCount}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Manual channel
                </Text>
                <Text fw={750}>{form.slackChannel}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Leave coordination is manual. The app does not send messages or read Slack threads.
              </Text>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Title order={3} size="h4">
              Notes
            </Title>
            <Stack gap="xs" mt="md">
              <Text size="sm">Update -3, -2, and -1 net velocity/dev after Jira reporting is read.</Text>
              <Text size="sm">Check previous and upcoming OOO rows before finalizing capacity.</Text>
              <Text size="sm">
                Jira close remains manual; Jira reporting import is read-only for {form.jiraProjectKey}.
              </Text>
              {form.velocityOverrideReason.trim() === "" ? null : (
                <Alert color="teal" variant="light" title="Override reason">
                  {form.velocityOverrideReason}
                </Alert>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>

        <Paper withBorder radius="md" p="md">
          <Title order={3} size="h4">
            Manual leave request draft
          </Title>
          <Text component="pre" className="preview-block" mt="md">
            {slackPreview}
          </Text>
        </Paper>
      </Stack>
    );
  }

  function renderTeamProfileContent() {
    return (
      <Grid gap="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Paper withBorder radius="md" p="lg">
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start" gap="md">
                <SectionHeading
                  icon={Settings2}
                  title="Team profile"
                  description="Team defaults shared by current and future coworkers."
                />
                <Group gap="xs">
                  <Button variant="default" leftSection={<Settings2 size={16} />} onClick={loadTeamConfig}>
                    Load
                  </Button>
                  <Button variant="light" leftSection={<SaveIcon size={16} />} onClick={saveTeamConfig}>
                    Save
                  </Button>
                </Group>
              </Group>

              <Alert color="blue" variant="light" title="Profile-owned team context">
                A user can belong to multiple teams, and each team can have multiple users. For now, this profile keeps
                one active team view at a time; later the profile dropdown can switch teams from DevPortal while Jira
                provides the current active sprint.
              </Alert>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Team key"
                  value={form.teamKey}
                  onChange={(event) => updateText("teamKey", event.currentTarget.value)}
                />
                <TextInput
                  label="Team name"
                  value={form.teamName}
                  onChange={(event) => updateText("teamName", event.currentTarget.value)}
                />
                <TextInput
                  label="Team project name"
                  value={form.jiraProjectName}
                  onChange={(event) => updateText("jiraProjectName", event.currentTarget.value)}
                />
                <TextInput
                  label="Jira project key"
                  value={form.jiraProjectKey}
                  onChange={(event) => updateText("jiraProjectKey", event.currentTarget.value)}
                />
                <TextInput
                  label="Jira board"
                  value={form.jiraBoardName}
                  onChange={(event) => updateText("jiraBoardName", event.currentTarget.value)}
                />
                <TextInput
                  label="Manual leave channel"
                  value={form.slackChannel}
                  onChange={(event) => updateText("slackChannel", event.currentTarget.value)}
                />
                <TextInput
                  label="Sprint naming pattern"
                  placeholder="Q{quarter}S{sprint} - {year}"
                  value={form.sprintNamingPattern}
                  onChange={(event) => updateText("sprintNamingPattern", event.currentTarget.value)}
                />
                <NumberInput
                  label="Default working days"
                  min={0}
                  value={form.daysInSprintExcludingHolidays}
                  onChange={(value) => updateNumber("daysInSprintExcludingHolidays", numberInputValue(value))}
                />
                <NumberInput
                  label="Team members"
                  min={1}
                  value={form.teamMemberCount}
                  onChange={(value) => updateNumber("teamMemberCount", numberInputValue(value))}
                />
              </SimpleGrid>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="lg">
            <Paper withBorder radius="md" p="lg">
              <SectionHeading icon={Goal} title="Current active sprint" />
              <Stack gap="sm" mt="lg">
                <InfoRow label="Team" value={form.teamName} />
                <InfoRow label="Sprint" value={form.currentSprintName} />
                <InfoRow label="Dates" value={`${form.currentSprintStart} to ${form.currentSprintEnd}`} />
                <InfoRow label="Previous sprint" value={form.previousSprintName} />
                <InfoRow label="Sprint source" value="Jira active sprint later" />
                <InfoRow label="Net velocity/dev" value={String(summaryVelocityPerDeveloper)} />
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="lg" className="sheet-summary-panel">
              <Title order={3} size="h4">
                Team members
              </Title>
              <Text size="sm" c="dimmed" mt={4}>
                Member rows are local planning data for now; DevPortal can own this list later.
              </Text>
              <Table mt="md" verticalSpacing="xs" withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>User id</Table.Th>
                    <Table.Th>Upcoming OOO</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {leaveConfirmations.map((member, index) => (
                    <Table.Tr key={`${member.slackUserId}-${index}`}>
                      <Table.Td>
                        <TextInput
                          aria-label={`Team member ${index + 1} name`}
                          value={member.teammateName}
                          onChange={(event) => updateTeamMember(index, "teammateName", event.currentTarget.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          aria-label={`Team member ${index + 1} user id`}
                          value={member.slackUserId}
                          onChange={(event) => updateTeamMember(index, "slackUserId", event.currentTarget.value)}
                        />
                      </Table.Td>
                      <Table.Td>{member.upcomingSprintLeaveDays}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    );
  }

  return (
    <AppShell header={{ height: 68 }} padding={0}>
      <AppShell.Header withBorder>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" gap="md" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Box className="brand-mark">
                <Bot size={22} aria-hidden="true" />
              </Box>
              <Box>
                <Text fw={800} lh={1.15}>
                  AI CoWorkers / Scrum Master
                </Text>
                <Text size="xs" c="dimmed" visibleFrom="sm">
                  Jira-first sprint planning
                </Text>
              </Box>
            </Group>
            <Group gap="xs" justify="flex-end" wrap="nowrap">
              <Badge variant="light" color="gray" visibleFrom="sm">
                {form.jiraProjectKey}
              </Badge>
              <Badge color="dark" variant="filled" tt="uppercase">
                Env: {connectorMode}
              </Badge>
              <Menu position="bottom-end" shadow="md" width={280}>
                <Menu.Target>
                  <Button
                    variant="default"
                    leftSection={
                      <Avatar color="teal" radius="xl" size={24}>
                        {form.teamKey.slice(0, 2).toUpperCase()}
                      </Avatar>
                    }
                    rightSection={<UserRound size={15} />}
                  >
                    {form.teamName}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Profile</Menu.Label>
                  <Menu.Item disabled>{form.teamName} · current team view</Menu.Item>
                  <Menu.Item disabled>Switch teams from DevPortal later</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item leftSection={<Settings2 size={15} />} onClick={() => setIsTeamProfileOpen(true)}>
                    Team profile
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main className="planner-app">
        {viewMode === "home" ? (
          <Container size="xl" py="xl">
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start" gap="md">
                <Box>
                  <Title order={1} size="h2">
                    Sprint plans
                  </Title>
                  <Text c="dimmed" mt={4}>
                    Resume, review, or clone sprint planning sessions.
                  </Text>
                </Box>
                <Button leftSection={<Plus size={16} />} onClick={startNewPlanningSession}>
                  New sprint plan
                </Button>
              </Group>

              <Tabs value="sprint-planner">
                <Tabs.List>
                  <Tabs.Tab value="sprint-planner" leftSection={<FolderOpen size={15} />}>
                    Sprint planner
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="sprint-planner" pt="lg">
                  <Stack gap="md">
                    <Paper withBorder radius="md" p="md">
                      <Group gap="sm" align="end">
                        <TextInput
                          label="Search sprint"
                          placeholder="Q2S7 - 2026"
                          leftSection={<Search size={16} />}
                          value={sessionSearch}
                          onChange={(event) => setSessionSearch(event.currentTarget.value)}
                          className="session-search"
                        />
                        <Button
                          variant="default"
                          leftSection={<History size={16} />}
                          onClick={() => refreshSavedSessions("Refreshing sprint planning sessions...")}
                        >
                          Refresh
                        </Button>
                      </Group>
                    </Paper>

                    {savedSessions.length === 0 ? (
                      <Paper withBorder radius="md" p="xl" ta="center">
                        <FolderOpen size={34} aria-hidden="true" />
                        <Title order={2} size="h3" mt="sm">
                          No sprint plans saved yet
                        </Title>
                        <Text c="dimmed" mt={4}>
                          Start a sprint plan and save it once to make it available here for resume and review.
                        </Text>
                        <Button mt="lg" leftSection={<Plus size={16} />} onClick={startNewPlanningSession}>
                          Start sprint plan
                        </Button>
                      </Paper>
                    ) : visibleSavedSessions.length === 0 ? (
                      <Paper withBorder radius="md" p="xl" ta="center">
                        <Title order={2} size="h3">
                          No matching sprint plans
                        </Title>
                        <Text c="dimmed" mt={4}>
                          Clear the search to see saved sprint plans.
                        </Text>
                      </Paper>
                    ) : (
                      visibleSavedSessions.map((session) => (
                        <SprintPlanCard
                          key={session.sessionId}
                          session={session}
                          onOpen={() => loadSession(session.sessionId)}
                          onClone={() => cloneSavedSession(session.sessionId)}
                        />
                      ))
                    )}
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Stack>
          </Container>
        ) : (
          <Container size="xl" py="lg">
            <Stack gap="lg">
              <Paper withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Box>
                    <Group gap="xs" mb={4}>
                      <Badge color="teal" variant="light">
                        Active sprint plan
                      </Badge>
                      <Text size="sm" c={isDirty ? "orange" : "dimmed"}>
                        {isDirty ? "unsaved changes" : lastSavedLabel}
                      </Text>
                    </Group>
                    <Title order={1} size="h2">
                      {form.currentSprintName}
                    </Title>
                    <Text c="dimmed">{sessionLabel}</Text>
                  </Box>
                  <Group gap="xs">
                    <Button
                      variant="default"
                      leftSection={<History size={16} />}
                      disabled={isConnectorRunning}
                      onClick={() => {
                        void refreshSavedSessions("Refreshing sprint planning sessions...");
                        setViewMode("home");
                      }}
                    >
                      Sprint list
                    </Button>
                    <Button leftSection={<SaveIcon size={16} />} onClick={saveSession} disabled={isConnectorRunning}>
                      Save
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<FolderOpen size={16} />}
                      onClick={openSessionBrowser}
                      disabled={isConnectorRunning}
                    >
                      Open
                    </Button>
                  </Group>
                </Group>
              </Paper>

              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                <MetricBlock
                  label="Net velocity/dev"
                  value={summaryVelocityPerDeveloper}
                  caption={`${summaryVelocity} total`}
                  dominant
                />
                <MetricBlock label="Average/dev" value={planning.averageNetVelocityPerDeveloper} />
                <MetricBlock label="Capacity/dev" value={planning.capacityAdjustedVelocityPerDeveloper} />
                <MetricBlock label="Leaves" value={form.previousSprintLeaveDays + form.upcomingSprintLeaveDays} />
              </SimpleGrid>

              <Paper withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Box>
                    <Text fw={750}>Connector actions</Text>
                    <Text size="sm" c="dimmed">
                      {sessionId == null
                        ? "Save this planning session before running Jira reads."
                        : isDirty
                          ? "Save changes to read Jira against the latest saved session."
                          : "Run read-only Jira reporting against this saved session. Leave collection stays manual and editable in the workflow."}
                    </Text>
                  </Box>
                  <Group gap="xs">
                    <Button
                      variant="default"
                      leftSection={<Table2 size={16} />}
                      disabled={connectorActionsDisabled}
                      onClick={() => runSavedConnectorAction("fetch-closed-story-points")}
                    >
                      Jira net velocity/dev
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<Sparkles size={16} />}
                      disabled={connectorActionsDisabled}
                      onClick={runSavedConnectorWorkflow}
                    >
                      Run Jira read
                    </Button>
                  </Group>
                </Group>
              </Paper>

              <Grid gap="lg" align="flex-start">
                <Grid.Col span={{ base: 12, md: 3 }}>
                  <Paper withBorder radius="md" p="md" className="stepper-panel">
                    <WorkflowStepper
                      steps={workflowStepDefinitions}
                      activeStepId={activeStepId}
                      getState={getWorkflowStepState}
                      onStepClick={navigateWorkflowStep}
                      mobile={mobileStepper}
                    />
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper withBorder radius="md" p={{ base: "md", sm: "lg" }}>
                    <Stack gap="lg">
                      <Group justify="space-between" align="flex-start" gap="md">
                        <Box>
                          <Text size="xs" c="dimmed" fw={800} tt="uppercase">
                            Step {activeStepIndex + 1}
                          </Text>
                          <Title order={2} size="h3">
                            {activeStep.title}
                          </Title>
                          <Text c="dimmed" size="sm" mt={4}>
                            {activeStep.description}
                          </Text>
                        </Box>
                        {activeStep.connector ? (
                          <Badge variant="light" color={activeStep.connector === "jira" ? "blue" : "teal"}>
                            {activeStep.connector} connector
                          </Badge>
                        ) : null}
                      </Group>

                      {renderStepContent()}

                      <Group justify="space-between" gap="sm">
                        <Button
                          variant="default"
                          disabled={!previousStep}
                          onClick={() => previousStep && setActiveStepId(previousStep.id)}
                        >
                          Back
                        </Button>
                        <Group gap="xs">
                          {activeStepId !== "finalize" ? (
                            <Button variant="default" onClick={() => skipStep(activeStepId)}>
                              Skip
                            </Button>
                          ) : null}
                          <Button
                            disabled={
                              isConnectorRunning ||
                              (activeStepId === "jira-reporting" && connectorActionsDisabled)
                            }
                            onClick={runActiveStepPrimaryAction}
                          >
                            {activeStep.primaryAction}
                          </Button>
                        </Group>
                      </Group>

                      <Text size="sm" c="dimmed" aria-live="polite">
                        {draftStatus}
                      </Text>
                    </Stack>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 3 }}>
                  <WorkflowSummary
                    summaryVelocityPerDeveloper={summaryVelocityPerDeveloper}
                    summaryVelocity={summaryVelocity}
                    planning={planning}
                    workflowChecklist={workflowChecklist}
                    slackPreview={slackPreview}
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          </Container>
        )}
      </AppShell.Main>

      <Modal
        opened={isTeamProfileOpen}
        onClose={() => setIsTeamProfileOpen(false)}
        title="Profile / Team"
        size="xl"
      >
        {renderTeamProfileContent()}
      </Modal>

      <Modal
        opened={isSessionBrowserOpen}
        onClose={() => setIsSessionBrowserOpen(false)}
        title="Open or clone sprint planning session"
        size="xl"
      >
        <Stack gap="md">
          {savedSessions.length === 0 ? (
            <Text c="dimmed">No saved sprint planning sessions for {form.teamKey} yet.</Text>
          ) : (
            savedSessions.map((session) => (
              <Paper withBorder radius="md" p="md" key={session.sessionId}>
                <Group justify="space-between" align="flex-start" gap="md">
                  <Box>
                    <Group gap="xs" mb={4}>
                      <Badge color="teal" variant="light">
                        Sprint plan
                      </Badge>
                      <Text size="sm" c="dimmed">
                        {session.currentSprintDates.start} to {session.currentSprintDates.end}
                      </Text>
                    </Group>
                    <Title order={3} size="h4">
                      {session.currentSprintName}
                    </Title>
                    <Text size="sm" c="dimmed">
                      From {session.previousSprintName} - {formatSavedAt(session.updatedAt)}
                    </Text>
                    <Group gap="xs" mt="xs">
                      <Badge variant="light">{session.sprintVelocityPerDeveloper} net velocity/dev</Badge>
                      <Badge variant="light" color="gray">
                        {session.sprintVelocity} total
                      </Badge>
                      <Badge variant="light" color="yellow">
                        {session.pendingLeaveConfirmations} pending leaves
                      </Badge>
                    </Group>
                  </Box>
                  <Group gap="xs">
                    <Button variant="default" leftSection={<FolderOpen size={16} />} onClick={() => loadSession(session.sessionId)}>
                      Open
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<Copy size={16} />}
                      onClick={() => cloneSavedSession(session.sessionId)}
                      disabled={cloneDisabled}
                    >
                      Clone to new sprint
                    </Button>
                  </Group>
                </Group>
              </Paper>
            ))
          )}
        </Stack>
      </Modal>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={700} ta="right">
        {value}
      </Text>
    </Group>
  );
}
