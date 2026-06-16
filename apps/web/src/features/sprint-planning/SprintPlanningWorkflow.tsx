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
  Goal,
  ListChecks,
  MessageSquare,
  Settings2,
  Sparkles,
  Table2
} from "lucide-react";
import { createSprintPlanningWorkflowDraft, getSprintPlanningTeamConfig } from "./sprintPlanningApi";
import { calculatePlanning, toNumber, toSprintPlanningInput } from "./sprintPlanningCalculations";
import type { AutomationStep, DraftResponse, PlanningForm } from "./sprintPlanningTypes";

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

const statusLabels: Record<AutomationStep["status"], string> = {
  ready: "Ready",
  "connector-pending": "Connector pending",
  "team-input": "Team input",
  "replaced-by-app": "Excel replaced"
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

export function SprintPlanningWorkflow() {
  const [form, setForm] = useState(initialForm);
  const [draftStatus, setDraftStatus] = useState("Not synced with API yet");
  const [apiPlan, setApiPlan] = useState<DraftResponse["data"] | null>(null);
  const planning = useMemo(() => calculatePlanning(form), [form]);
  const apiOutput = apiPlan?.output;
  const workflowChecklist = apiOutput?.checklist ?? workflowSteps;
  const slackPreview = apiOutput?.slackLeaveRequestPreview ?? fallbackSlackPreview(form);

  function updateText(field: keyof PlanningForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateNumber(field: keyof PlanningForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: toNumber(value)
    }));
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
    } catch {
      setDraftStatus("Team config unavailable; keep editing local values");
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
  }

  const summaryVelocity = apiPlan?.output.sprintVelocity ?? planning.sprintVelocity;

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
          <small>{draftStatus}</small>
        </aside>
      </section>

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
          <div className="field-grid">
            <NumberField
              label="Pre-previous velocity (-3)"
              value={form.previousVelocityMinus3}
              onChange={(value) => updateNumber("previousVelocityMinus3", value)}
            />
            <NumberField
              label="Previous velocity (-2)"
              value={form.previousVelocityMinus2}
              onChange={(value) => updateNumber("previousVelocityMinus2", value)}
            />
            <NumberField
              label="Last net velocity (-1)"
              value={form.lastNetVelocity}
              onChange={(value) => updateNumber("lastNetVelocity", value)}
            />
            <NumberField
              label="Previous sprint leave days"
              value={form.previousSprintLeaveDays}
              onChange={(value) => updateNumber("previousSprintLeaveDays", value)}
            />
            <NumberField
              label="Upcoming leave days"
              value={form.upcomingSprintLeaveDays}
              onChange={(value) => updateNumber("upcomingSprintLeaveDays", value)}
            />
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
