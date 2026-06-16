import React from "react";
import { createRoot } from "react-dom/client";
import { Activity, CalendarCheck, Goal, RefreshCw, SearchCheck, UsersRound } from "lucide-react";
import "./styles.css";

const ceremonySteps = [
  {
    icon: SearchCheck,
    title: "Sprint grooming",
    description: "Review backlog readiness, missing acceptance criteria, stale tickets, and priority conflicts."
  },
  {
    icon: CalendarCheck,
    title: "Sprint planning",
    description: "Turn Jira scope, capacity, dependencies, and team goals into a clear sprint plan."
  },
  {
    icon: RefreshCw,
    title: "Mid-sprint adjustments",
    description: "Detect blockers, scope drift, and aging work so the team can adapt early."
  },
  {
    icon: Activity,
    title: "Daily standups",
    description: "Summarize progress, carry forward follow-ups, and highlight risks without meeting overhead."
  },
  {
    icon: Goal,
    title: "Goal tracking",
    description: "Track milestones, sprint goals, epics, and delivery health against Jira signals."
  },
  {
    icon: UsersRound,
    title: "Sprint retro",
    description: "Generate retro themes, action items, and continuity from the previous sprint."
  }
];

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">AI CoWorkers</p>
          <h1>Your first AI coworker is a Jira-focused Scrum Master.</h1>
          <p className="hero-copy">
            From autocomplete to autonomous workflows, the next product step is a coworker that can own repeatable
            engineering coordination work with real project context.
          </p>
          <div className="hero-actions">
            <a href="#scrum-master">View coworker scope</a>
            <a href="#architecture" className="secondary-action">
              Tech stack
            </a>
          </div>
        </div>
      </section>

      <section className="section" id="scrum-master">
        <div className="section-heading">
          <p className="eyebrow">Coworker 01</p>
          <h2>Scrum Master for Jira teams</h2>
          <p>
            The initial coworker targets the ceremony loop most teams repeat every sprint: grooming, planning,
            standups, scope changes, tracking, and retrospectives.
          </p>
        </div>

        <div className="workflow-grid">
          {ceremonySteps.map((step) => {
            const Icon = step.icon;

            return (
              <article className="workflow-card" key={step.title}>
                <span className="icon-wrap">
                  <Icon size={22} strokeWidth={2} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="architecture" id="architecture">
        <div>
          <p className="eyebrow">Architecture</p>
          <h2>React UI, TypeScript backend, Jira-first integration.</h2>
        </div>
        <div className="stack-list" aria-label="Technology stack">
          <span>React</span>
          <span>TypeScript</span>
          <span>Node API</span>
          <span>Jira</span>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

