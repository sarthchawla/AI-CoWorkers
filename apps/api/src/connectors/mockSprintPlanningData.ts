export const mockTeamSprintPlanningConfigs = {
  pta: {
    teamKey: "pta",
    teamName: "PTA",
    members: [
      {
        name: "Anika",
        externalUserId: "anika",
        slackUserId: "U-ANIKA",
        role: "Engineer",
        active: true
      },
      {
        name: "Dev",
        externalUserId: "dev",
        slackUserId: "U-DEV",
        role: "Engineer",
        active: true
      },
      {
        name: "Mei",
        externalUserId: "mei",
        slackUserId: "U-MEI",
        role: "Engineer",
        active: true
      },
      {
        name: "Ravi",
        externalUserId: "ravi",
        slackUserId: "U-RAVI",
        role: "Engineer",
        active: true
      },
      {
        name: "Sara",
        externalUserId: "sara",
        slackUserId: "U-SARA",
        role: "Engineer",
        active: true
      }
    ],
    jira: {
      cloudId: "681413ed-e457-48de-8251-e5aa1222e0e2",
      projectName: "PTA Trip planner Agent",
      projectId: "14791",
      projectKey: "PTATPA",
      boardName: "PTA Sprint Board",
      boardId: "10357",
      sprintField: "customfield_10020",
      storyPointsField: "customfield_10024",
      doneStatusCategory: "done"
    },
    slack: {
      channelName: "#pta-sprint-planning"
    },
    defaults: {
      teamMemberCount: 5,
      daysInSprintExcludingHolidays: 10,
      sprintNamingPattern: "Q{quarter}S{sprint} - {year}"
    }
  }
};

export const mockJiraVelocityHistory = [
  {
    sprintOffset: -3,
    sprintName: "Q2S4 - 2026",
    startDate: "2026-05-05",
    endDate: "2026-05-16",
    completedStoryPoints: 82,
    leaveDays: 1,
    netVelocity: 82,
    source: "mock-jira-report"
  },
  {
    sprintOffset: -2,
    sprintName: "Q2S5 - 2026",
    startDate: "2026-05-19",
    endDate: "2026-05-30",
    completedStoryPoints: 88,
    leaveDays: 2,
    netVelocity: 88,
    source: "mock-jira-report"
  },
  {
    sprintOffset: -1,
    sprintName: "Q2S6 - 2026",
    startDate: "2026-06-01",
    endDate: "2026-06-12",
    completedStoryPoints: 84,
    leaveDays: 2,
    netVelocity: 84,
    source: "mock-jira-report"
  }
] as const;

export const mockJiraSprintIds: Record<string, string> = {
  "Q2S4 - 2026": "jira-sprint-204",
  "Q2S5 - 2026": "jira-sprint-205",
  "Q2S6 - 2026": "jira-sprint-206"
};
