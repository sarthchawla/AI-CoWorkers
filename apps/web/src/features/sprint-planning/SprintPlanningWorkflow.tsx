import { useMemo, useState } from "react";
import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileText,
  FolderOpen,
  Goal,
  ListChecks,
  MessageSquare,
  Save as SaveIcon,
  Settings2,
  Sparkles,
  Table2
} from "lucide-react";
import {
  createSprintPlanningWorkflowDraft,
  getSprintPlanningSession,
  getJiraVelocityHistory,
  getSlackLeaveConfirmations,
  getSprintPlanningTeamConfig,
  listSprintPlanningSessions,
  runSprintPlanningConnectorAction,
  saveSprintPlanningSession
} from "./sprintPlanningApi";
import { calculatePlanning, toNumber, toSprintPlanningInput } from "./sprintPlanningCalculations";
import type {
  AutomationStep,
  DraftResponse,
  LeaveConfirmationRow,
  PlanningStatus,
  PlanningForm,
  SavedSprintPlanningSession,
  SavedSprintPlanningSessionSummary,
  SprintPlanningConnectorActionKey,
  SprintPlanningInput,
  VelocityHistoryRow
} from "./sprintPlanningTypes";

const initialForm: PlanningForm = {
  teamKey: "pta",
  teamName: "PTA",
  jiraProjectKey: "PTATPA",
  jiraBoardName: "PTA Sprint Board",
  slackChannel: "#pta-sprint-planning",
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
  manualVelocityOverride: "",
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
    label: "Close the previous Jira sprint and read completed story points from reporting.",
    owner: "Jira connector",
    status: "connector-pending"
  },
  {
    id: "velocity",
    label: "Calculate average net velocity, capacity adjustment, and final team-approved sprint velocity.",
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

function nextSprintName(previousSprintName: string) {
  const match = previousSprintName.match(/^Q(\d+)S(\d+)\s*-\s*(\d{4})$/i);

  if (!match) {
    return previousSprintName;
  }

  return `Q${match[1]}S${Number(match[2]) + 1} - ${match[3]}`;
}

function fallbackSlackPreview(form: PlanningForm) {
  return [
    `Hi team, please update leaves for ${form.previousSprintName} and ${form.currentSprintName}.`,
    `Current plan has ${form.previousSprintLeaveDays} previous sprint leave days and ${form.upcomingSprintLeaveDays} upcoming sprint leave days recorded.`,
    "Please reply with any corrections before sprint planning is finalized."
  ].join("\n");
}

function toPlanningForm(input: SprintPlanningInput): PlanningForm {
  return {
    teamKey: input.teamKey ?? "",
    teamName: input.teamName,
    jiraProjectKey: input.jiraProjectKey,
    jiraBoardName: input.jiraBoardName,
    slackChannel: input.slackChannel,
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
    manualVelocityOverride: input.manualVelocityOverride == null ? "" : String(input.manualVelocityOverride),
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
  const [isSessionBrowserOpen, setIsSessionBrowserOpen] = useState(false);
  const [isConnectorRunning, setIsConnectorRunning] = useState(false);
  const planning = useMemo(() => calculatePlanning(form), [form]);
  const apiOutput = apiPlan?.output;
  const workflowChecklist = apiOutput?.checklist ?? workflowSteps;
  const slackPreview = apiOutput?.slackLeaveRequestPreview ?? fallbackSlackPreview(form);

  function markDirty() {
    setIsDirty(true);
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
    } catch {
      setDraftStatus("API unavailable; showing local calculation");
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
        jiraProjectKey: config.jira.projectKey,
        jiraBoardName: config.jira.boardName,
        slackChannel: config.slack.channelName,
        teamMemberCount: config.defaults.teamMemberCount,
        daysInSprintExcludingHolidays: config.defaults.daysInSprintExcludingHolidays
      }));
      setDraftStatus("Team config loaded from backend defaults");
      markDirty();
    } catch {
      setDraftStatus("Team config unavailable; keep editing local values");
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
    } catch {
      setDraftStatus("Jira reporting import unavailable; keep editing velocity rows");
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
    } catch {
      setDraftStatus("Slack leave confirmation import unavailable; keep editing leave rows");
    }
  }

  function clonePreviousSprint() {
    setForm((current) => ({
      ...current,
      currentSprintName: nextSprintName(current.previousSprintName),
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
    } catch {
      setDraftStatus("Save failed; keep the session open and try again");
    }
  }

  function hydrateSavedSession(session: SavedSprintPlanningSession, statusMessage: string) {
    setForm(toPlanningForm(session.input));
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
    setDraftStatus("Loading saved sprint planning sessions...");

    try {
      const payload = await listSprintPlanningSessions(form.teamKey);

      setSavedSessions(payload.data);
      setIsSessionBrowserOpen(true);
      setDraftStatus(payload.data.length > 0 ? "Saved sessions loaded" : "No saved sessions for this team yet");
    } catch {
      setDraftStatus("Saved sessions unavailable");
    }
  }

  async function loadSession(nextSessionId: string) {
    setDraftStatus("Opening saved sprint planning session...");

    try {
      const payload = await getSprintPlanningSession(nextSessionId);
      const session = payload.data;

      setIsSessionBrowserOpen(false);
      hydrateSavedSession(session, `Opened saved session for ${session.input.currentSprintName}`);
    } catch {
      setDraftStatus("Saved session could not be opened");
    }
  }

  async function runSavedConnectorAction(actionKey: SprintPlanningConnectorActionKey) {
    if (sessionId == null) {
      setDraftStatus("Save this planning session before running connectors");
      return;
    }

    if (isDirty) {
      setDraftStatus("Save changes before running connectors against this session");
      return;
    }

    const runningMessages: Record<SprintPlanningConnectorActionKey, string> = {
      "collect-leaves": "Collecting saved-session Slack leave confirmations...",
      "close-previous-sprint": "Closing previous sprint in saved-session Jira preview...",
      "fetch-closed-story-points": "Importing saved-session Jira story points..."
    };
    const successMessages: Record<SprintPlanningConnectorActionKey, string> = {
      "collect-leaves": "Slack leave confirmations updated in saved session",
      "close-previous-sprint": "Previous sprint closure recorded in saved session",
      "fetch-closed-story-points": "Jira closed story points updated in saved session"
    };

    setDraftStatus(runningMessages[actionKey]);
    setIsConnectorRunning(true);

    try {
      const payload = await runSprintPlanningConnectorAction(sessionId, actionKey);
      hydrateSavedSession(payload.data.session, successMessages[actionKey]);
    } catch {
      setDraftStatus("Connector action failed; saved session was not updated");
    } finally {
      setIsConnectorRunning(false);
    }
  }

  async function runSavedConnectorWorkflow() {
    await runSavedConnectorAction("close-previous-sprint");
    await runSavedConnectorAction("fetch-closed-story-points");
    await runSavedConnectorAction("collect-leaves");
  }

  const summaryVelocity = apiPlan?.output.sprintVelocity ?? planning.sprintVelocity;
  const sessionLabel = sessionId == null ? "New planning session" : `${form.currentSprintName} saved draft`;
  const lastSavedLabel = lastSavedAt === "" ? "Not saved yet" : `Last saved ${new Date(lastSavedAt).toLocaleString()}`;
  const connectorActionsDisabled = sessionId == null || isDirty || isConnectorRunning;

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
            leaves, close the previous sprint, pull completed story points, and calculate team-approved velocity.
          </p>
        </div>
        <aside className="velocity-panel" aria-label="Sprint velocity output">
          <span className="panel-kicker">Sprint velocity</span>
          <strong>{summaryVelocity}</strong>
          <p>
            {planning.velocitySource} for {form.currentSprintName}
          </p>
          <button type="button" onClick={generateDraft}>
            <Sparkles size={18} />
            Generate SM workflow
          </button>
          <small aria-live="polite">{draftStatus}</small>
        </aside>
      </section>

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
          <button type="button" onClick={saveSession} disabled={isConnectorRunning}>
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
              Jira story points
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
              <h2 id="session-browser-title">Open sprint planning session</h2>
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
                <button type="button" key={session.sessionId} onClick={() => loadSession(session.sessionId)}>
                  <span>
                    <strong>{session.currentSprintName}</strong>
                    <small>
                      {session.currentSprintDates.start} to {session.currentSprintDates.end} · from{" "}
                      {session.previousSprintName}
                    </small>
                  </span>
                  <span className="session-meta">
                    <small>{session.planningStatus.replaceAll("_", " ")}</small>
                    <strong>{session.sprintVelocity} SP</strong>
                    <small>
                      {session.pendingLeaveConfirmations} pending leaves · {session.connectorPendingSteps} connector
                      steps
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="planning-grid">
        <form className="planning-form">
          <SectionTitle icon={Settings2} title="Team connectors" />
          <button className="inline-action" type="button" onClick={loadTeamConfig}>
            <Settings2 size={16} />
            Load team config
          </button>
          <div className="field-grid">
            <TextField
              label="Team key"
              value={form.teamKey}
              onChange={(value) => updateText("teamKey", value)}
            />
            <TextField label="Team" value={form.teamName} onChange={(value) => updateText("teamName", value)} />
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
          </div>

          <SectionTitle icon={CalendarDays} title="Sprint calendar" />
          <div className="inline-actions">
            <button className="inline-action" type="button" onClick={clonePreviousSprint}>
              <Copy size={16} />
              Clone previous sprint context
            </button>
            <button className="inline-action" type="button" onClick={calculateWorkingDays}>
              <CalendarDays size={16} />
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

          <SectionTitle icon={Table2} title="Velocity and capacity" />
          <div className="inline-actions">
            <button className="inline-action" type="button" onClick={importJiraVelocityHistory}>
              <Table2 size={16} />
              Import Jira velocity history
            </button>
            <button className="inline-action" type="button" onClick={importSlackLeaveConfirmations}>
              <MessageSquare size={16} />
              Import Slack leave confirmations
            </button>
          </div>
          <div className="velocity-history" aria-describedby="velocity-history-help">
            <table>
              <caption>Velocity history used for average</caption>
              <thead>
                <tr>
                  <th scope="col">Sprint</th>
                  <th scope="col">Net velocity</th>
                </tr>
              </thead>
              <tbody>
                {velocityHistory.map((row) => (
                  <tr key={row.sprintOffset}>
                    <th scope="row">
                      <span>{row.sprintOffset === -1 ? "Last closed sprint" : `${Math.abs(row.sprintOffset)} sprints ago`}</span>
                      <small>
                        {row.sprintName} · {row.completedStoryPoints} closed SP · {row.leaveDays} leave days ·{" "}
                        <span className={`source-pill ${row.source}`}>
                          {row.source === "mock-jira-report" ? "Mock Jira" : "Manual"}
                        </span>
                      </small>
                    </th>
                    <td>
                      <input
                        min="0"
                        step="0.5"
                        type="number"
                        value={row.netVelocity}
                        aria-label={`Net velocity for ${row.sprintOffset === -1 ? "last closed sprint" : `${Math.abs(row.sprintOffset)} sprints ago`}`}
                        onChange={(event) =>
                          updateVelocityHistory(row.sprintOffset, "netVelocity", event.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p id="velocity-history-help">
              Average is calculated from the three net velocity values. Jira import updates the last closed sprint
              story points before the SM finalizes the override.
            </p>
          </div>
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
                {leaveConfirmations.map((row) => (
                  <tr key={row.slackUserId}>
                    <th scope="row">
                      <span>{row.teammateName}</span>
                      <small>
                        {row.confirmationStatus.replaceAll("_", " ")} ·{" "}
                        <span className={`source-pill ${row.source}`}>
                          {row.source === "mock-slack-thread" ? "Mock Slack" : "Manual"}
                        </span>
                      </small>
                    </th>
                    <td>
                      <input
                        min="0"
                        step="0.5"
                        type="number"
                        value={row.previousSprintLeaveDays}
                        aria-label={`Previous sprint leave days for ${row.teammateName}`}
                        onChange={(event) =>
                          updateLeaveConfirmation(row.slackUserId, "previousSprintLeaveDays", event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        min="0"
                        step="0.5"
                        type="number"
                        value={row.upcomingSprintLeaveDays}
                        aria-label={`Upcoming sprint leave days for ${row.teammateName}`}
                        onChange={(event) =>
                          updateLeaveConfirmation(row.slackUserId, "upcomingSprintLeaveDays", event.target.value)
                        }
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
          <div className="field-grid velocity-controls">
            <NumberField
              label="Confidence adjustment %"
              value={form.confidenceAdjustment}
              onChange={(value) => updateNumber("confidenceAdjustment", value)}
            />
            <TextField
              inputMode="decimal"
              label="Manual velocity override"
              placeholder="Optional"
              value={form.manualVelocityOverride}
              onChange={(value) => updateText("manualVelocityOverride", value)}
            />
            <TextField
              label="Override reason"
              placeholder="Confidence, low-effort spillover, or team call"
              value={form.velocityOverrideReason}
              onChange={(value) => updateText("velocityOverrideReason", value)}
            />
          </div>
        </form>

        <aside className="output-column">
          <article className="output-card">
            <SectionTitle icon={Goal} title="Velocity calculation" />
            <Metric label="Average net velocity" value={planning.averageNetVelocity} />
            <Metric label="Baseline capacity days" value={planning.baselineCapacityDays} />
            <Metric label="Available capacity days" value={planning.availableCapacityDays} />
            <Metric label="Capacity-adjusted velocity" value={planning.capacityAdjustedVelocity} />
            <Metric label="Confidence-adjusted velocity" value={planning.confidenceAdjustedVelocity} />
            <div className="final-metric">
              <span>Final sprint velocity</span>
              <strong>{summaryVelocity}</strong>
            </div>
          </article>

          <article className="output-card">
            <SectionTitle icon={ListChecks} title="SM workflow" />
            <div className="step-list">
              {workflowChecklist.map((step) => (
                <div className="step-row" key={step.id}>
                  <span className={`step-status ${step.status}`}>
                    <CheckCircle2 size={16} />
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
            <SectionTitle icon={MessageSquare} title="Slack leave request" />
            <pre className="preview-box">{slackPreview}</pre>
          </article>

          <article className="output-card">
            <SectionTitle icon={FileText} title="Jira close and report" />
            <div className="preview-list">
              <p>{apiOutput?.jiraCloseReportPreview.closeSprintAction ?? `Close ${form.previousSprintName} on Jira board ${form.jiraBoardName}`}</p>
              <p>{apiOutput?.jiraCloseReportPreview.reportingAction ?? `Fetch completed story points for ${form.previousSprintName} in ${form.jiraProjectKey}`}</p>
              <p>Last net velocity: {apiOutput?.jiraCloseReportPreview.lastNetVelocity ?? form.lastNetVelocity}</p>
            </div>
          </article>

          <article className="output-card connector-card">
            <SectionTitle icon={ClipboardCheck} title="Next connector actions" />
            <p>
              Jira and Slack are configurable inputs in this screen now. The next backend step is to replace manual
              values with connector reads for sprint closure, completed story points, and leave collection.
            </p>
            <div className="connector-links">
              <span>Jira API or MCP</span>
              <ArrowRight size={16} />
              <span>Planning engine</span>
              <ArrowRight size={16} />
              <span>Slack follow-up</span>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="section-title">
      <span>
        <Icon size={18} />
      </span>
      <h2>{title}</h2>
    </div>
  );
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
