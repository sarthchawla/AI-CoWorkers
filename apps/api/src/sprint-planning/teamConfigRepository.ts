import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mockTeamSprintPlanningConfigs } from "../connectors/mockSprintPlanningData.js";
import type { TeamSprintPlanningConfigInput } from "./schema.js";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../../..");
const defaultStorePath = path.join(repoRoot, "data", "sprint-planning-team-configs.json");
const storePath = process.env.SPRINT_PLANNING_TEAM_CONFIG_FILE ?? defaultStorePath;

type TeamConfigStore = {
  teamConfigs: TeamSprintPlanningConfigInput[];
};

function getMockTeamConfig(teamKey: string) {
  return (
    mockTeamSprintPlanningConfigs[teamKey as keyof typeof mockTeamSprintPlanningConfigs] ??
    mockTeamSprintPlanningConfigs.pta
  );
}

function mergeWithDefaultConfig(config: TeamSprintPlanningConfigInput, teamKey: string) {
  const defaultConfig = getMockTeamConfig(teamKey);

  return {
    ...defaultConfig,
    ...config,
    jira: {
      ...defaultConfig.jira,
      ...config.jira
    },
    slack: {
      ...defaultConfig.slack,
      ...config.slack
    },
    defaults: {
      ...defaultConfig.defaults,
      ...config.defaults
    }
  };
}

async function readStore(): Promise<TeamConfigStore> {
  try {
    const content = await readFile(storePath, "utf8");
    return JSON.parse(content) as TeamConfigStore;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { teamConfigs: [] };
    }

    throw error;
  }
}

async function writeStore(store: TeamConfigStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

export async function getTeamSprintPlanningConfig(teamKey: string) {
  const store = await readStore();
  const savedConfig = store.teamConfigs.find((config) => config.teamKey === teamKey);

  return savedConfig ? mergeWithDefaultConfig(savedConfig, teamKey) : getMockTeamConfig(teamKey);
}

export async function saveTeamSprintPlanningConfig(input: TeamSprintPlanningConfigInput) {
  const store = await readStore();
  const existingConfig = store.teamConfigs.find((config) => config.teamKey === input.teamKey);

  store.teamConfigs = existingConfig
    ? store.teamConfigs.map((config) => (config.teamKey === input.teamKey ? input : config))
    : [...store.teamConfigs, input];

  await writeStore(store);

  return input;
}
