import { useMemo, useState } from "react";
import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Goal,
  MessageSquare,
  Settings2,
  Sparkles,
  Table2
} from "lucide-react";
import { createSprintPlanningDraft } from "./sprintPlanningApi";
import { calculatePlanning, toNumber, toSprintPlanningInput } from "./sprintPlanningCalculations";
import type { AutomationStep, DraftResponse, PlanningForm } from "./sprintPlanningTypes";

const initialForm: PlanningForm = {
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
  plannedLeaveDays: 3,
  confidenceAdjustment: 0,
  manualVelocityOverride: ""
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

export function SprintPlanningWorkflow() {
  const [form, setForm] = useState(initialForm);
  const [draftStatus, setDraftStatus] = useState("Not synced with API yet");
  const [apiPlan, setApiPlan] = useState<DraftResponse["data"] | null>(null);
  const planning = useMemo(() => calculatePlanning(form), [form]);

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
      const payload = await createSprintPlanningDraft(toSprintPlanningInput(form));
      setApiPlan(payload.data ?? null);
      setDraftStatus("Draft generated from backend workflow engine");
    } catch {
      setDraftStatus("API unavailable; showing local calculation");
    }
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
          <div className="field-grid">
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
              label="Planned leave days"
              value={form.plannedLeaveDays}
              onChange={(value) => updateNumber("plannedLeaveDays", value)}
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
            <SectionTitle icon={ClipboardCheck} title="SM workflow" />
            <div className="step-list">
              {workflowSteps.map((step) => (
                <div className="step-row" key={step.id}>
                  <span className={`step-status ${step.status}`}>
                    <CheckCircle2 size={16} />
                  </span>
                  <div>
                    <p>{step.label}</p>
                    <small>
                      {step.owner} · {statusLabels[step.status]}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="output-card connector-card">
            <SectionTitle icon={MessageSquare} title="Next connector actions" />
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
