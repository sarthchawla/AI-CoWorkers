import type { TeamSprintPlanningConfigInput, VelocityHistoryRowInput } from "../sprint-planning/schema.js";

type JiraSprint = {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
};

type JiraSprintListResponse = {
  values: JiraSprint[];
  isLast?: boolean;
  startAt?: number;
  maxResults?: number;
};

type JiraIssue = {
  key: string;
  fields: Record<string, unknown> & {
    status?: {
      statusCategory?: {
        key?: string;
      };
    };
  };
};

type JiraIssueListResponse = {
  issues: JiraIssue[];
  isLast?: boolean;
  startAt?: number;
  maxResults?: number;
};

type ReadJiraVelocityHistoryInput = {
  teamConfig: TeamSprintPlanningConfigInput;
  previousSprintName: string;
  sprintCount: 3;
};

export type JiraVelocityHistoryPreview = {
  velocityHistory: VelocityHistoryRowInput[];
  warnings: string[];
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for live Jira connector mode`);
  }

  return value;
}

function jiraBaseUrl() {
  return requiredEnv("JIRA_BASE_URL").replace(/\/+$/, "");
}

function jiraAuthHeader() {
  const email = requiredEnv("JIRA_EMAIL");
  const token = requiredEnv("JIRA_API_TOKEN");
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

function compactFields(fields: string[]) {
  return Array.from(new Set(fields.filter(Boolean))).join(",");
}

function getNumberField(issue: JiraIssue, fieldName: string) {
  const rawValue = issue.fields[fieldName];

  if (typeof rawValue === "number") {
    return rawValue;
  }

  if (typeof rawValue === "string" && rawValue.trim()) {
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

function isoDateOnly(value?: string) {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function sprintTimestamp(sprint: JiraSprint) {
  return Date.parse(sprint.completeDate ?? sprint.endDate ?? sprint.startDate ?? "1970-01-01T00:00:00.000Z");
}

async function readJira<T>(pathname: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${jiraBaseUrl()}${pathname}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: jiraAuthHeader()
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jira read failed (${response.status}) for ${pathname}: ${body.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

async function readClosedSprints(boardId: string, sprintCount: number) {
  const sprints: JiraSprint[] = [];
  let startAt = 0;
  const maxResults = 50;

  while (sprints.length < sprintCount) {
    const response = await readJira<JiraSprintListResponse>(`/rest/agile/1.0/board/${boardId}/sprint`, {
      state: "closed",
      startAt,
      maxResults
    });

    sprints.push(...response.values);

    if (response.isLast || response.values.length === 0) {
      break;
    }

    startAt += response.maxResults ?? maxResults;
  }

  return sprints;
}

async function readSprintIssues(sprintId: number, storyPointsField: string) {
  const issues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const response = await readJira<JiraIssueListResponse>(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
      startAt,
      maxResults,
      fields: compactFields(["status", storyPointsField])
    });

    issues.push(...response.issues);

    if (response.isLast || response.issues.length === 0) {
      break;
    }

    startAt += response.maxResults ?? maxResults;
  }

  return issues;
}

export async function readJiraVelocityHistory(input: ReadJiraVelocityHistoryInput): Promise<JiraVelocityHistoryPreview> {
  const {
    boardId,
    storyPointsField = "customfield_10024",
    doneStatusCategory = "done"
  } = input.teamConfig.jira;

  if (!boardId) {
    throw new Error("Jira board id is required in team config for live Jira velocity import");
  }

  const warnings: string[] = [];
  const closedSprints = (await readClosedSprints(boardId, Math.max(input.sprintCount, 50))).sort(
    (left, right) => sprintTimestamp(right) - sprintTimestamp(left)
  );
  const latestClosedSprints = closedSprints.slice(0, input.sprintCount).reverse();
  const requestedSprint = closedSprints.find((sprint) => sprint.name === input.previousSprintName);

  if (!requestedSprint) {
    warnings.push(
      `${input.previousSprintName} is not in the latest closed Jira sprints for board ${boardId}; no Jira write was attempted.`
    );
  }

  const rows = await Promise.all(
    latestClosedSprints.map(async (sprint, index) => {
      const issues = await readSprintIssues(sprint.id, storyPointsField);
      const doneIssues = issues.filter(
        (issue) => issue.fields.status?.statusCategory?.key === doneStatusCategory
      );
      const completedStoryPoints = doneIssues.reduce(
        (total, issue) => total + getNumberField(issue, storyPointsField),
        0
      );

      return {
        sprintOffset: (-3 + index) as -3 | -2 | -1,
        sprintName: sprint.name,
        jiraSprintId: String(sprint.id),
        startDate: isoDateOnly(sprint.startDate),
        endDate: isoDateOnly(sprint.endDate ?? sprint.completeDate),
        completedStoryPoints,
        leaveDays: 0,
        netVelocity: completedStoryPoints,
        source: "jira_report" as const,
        includeInAverage: true
      };
    })
  );

  if (rows.length < input.sprintCount) {
    warnings.push(`Jira returned ${rows.length} closed sprint rows; expected ${input.sprintCount}.`);
  }

  return {
    velocityHistory: rows,
    warnings
  };
}
