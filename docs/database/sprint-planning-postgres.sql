CREATE TABLE sprint_planning_team_configs (
  team_config_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_key TEXT NOT NULL UNIQUE,
  team_name TEXT NOT NULL,
  jira_project_key TEXT NOT NULL,
  jira_board_name TEXT NOT NULL,
  jira_board_id TEXT,
  slack_channel_name TEXT NOT NULL,
  slack_channel_id TEXT,
  default_team_member_count BIGINT NOT NULL CHECK (default_team_member_count > 0),
  default_days_in_sprint_excluding_holidays BIGINT NOT NULL CHECK (default_days_in_sprint_excluding_holidays > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sprint_planning_sessions (
  sprint_planning_session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_config_id BIGINT NOT NULL REFERENCES sprint_planning_team_configs(team_config_id) ON DELETE RESTRICT,
  previous_sprint_name TEXT NOT NULL,
  current_sprint_name TEXT NOT NULL,
  previous_sprint_start_date DATE NOT NULL,
  previous_sprint_end_date DATE NOT NULL,
  current_sprint_start_date DATE NOT NULL,
  current_sprint_end_date DATE NOT NULL,
  days_in_sprint_excluding_holidays BIGINT NOT NULL CHECK (days_in_sprint_excluding_holidays >= 0),
  holiday_count BIGINT NOT NULL DEFAULT 0 CHECK (holiday_count >= 0),
  team_member_count BIGINT NOT NULL CHECK (team_member_count > 0),
  previous_sprint_leave_days NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (previous_sprint_leave_days >= 0),
  upcoming_sprint_leave_days NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (upcoming_sprint_leave_days >= 0),
  confidence_adjustment_percent NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (
    confidence_adjustment_percent >= -50
    AND confidence_adjustment_percent <= 50
  ),
  manual_velocity_override NUMERIC(8, 2) CHECK (manual_velocity_override >= 0),
  velocity_override_reason TEXT,
  planning_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    planning_status IN ('draft', 'ready_for_review', 'finalized', 'published')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sprint_planning_velocity_history (
  velocity_history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sprint_planning_session_id BIGINT NOT NULL REFERENCES sprint_planning_sessions(sprint_planning_session_id) ON DELETE CASCADE,
  sprint_offset BIGINT NOT NULL CHECK (sprint_offset IN (-3, -2, -1)),
  sprint_name TEXT NOT NULL,
  completed_story_points NUMERIC(8, 2) NOT NULL CHECK (completed_story_points >= 0),
  leave_days NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (leave_days >= 0),
  net_velocity NUMERIC(8, 2) NOT NULL CHECK (net_velocity >= 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'mock-jira-report', 'jira_report')),
  include_in_average BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sprint_planning_session_id, sprint_offset)
);

CREATE TABLE sprint_planning_calculations (
  sprint_planning_calculation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sprint_planning_session_id BIGINT NOT NULL UNIQUE REFERENCES sprint_planning_sessions(sprint_planning_session_id) ON DELETE CASCADE,
  average_net_velocity NUMERIC(8, 2) NOT NULL CHECK (average_net_velocity >= 0),
  baseline_capacity_days NUMERIC(8, 2) NOT NULL CHECK (baseline_capacity_days >= 0),
  available_capacity_days NUMERIC(8, 2) NOT NULL CHECK (available_capacity_days >= 0),
  capacity_ratio NUMERIC(8, 4) NOT NULL CHECK (capacity_ratio >= 0),
  capacity_adjusted_velocity NUMERIC(8, 2) NOT NULL CHECK (capacity_adjusted_velocity >= 0),
  confidence_adjusted_velocity NUMERIC(8, 2) NOT NULL CHECK (confidence_adjusted_velocity >= 0),
  sprint_velocity NUMERIC(8, 2) NOT NULL CHECK (sprint_velocity >= 0),
  velocity_source TEXT NOT NULL CHECK (velocity_source IN ('system-suggested', 'team-override')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sprint_planning_leave_confirmations (
  leave_confirmation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sprint_planning_session_id BIGINT NOT NULL REFERENCES sprint_planning_sessions(sprint_planning_session_id) ON DELETE CASCADE,
  teammate_name TEXT NOT NULL,
  previous_sprint_leave_days NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (previous_sprint_leave_days >= 0),
  upcoming_sprint_leave_days NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (upcoming_sprint_leave_days >= 0),
  confirmation_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    confirmation_status IN ('pending', 'confirmed', 'updated_by_sm')
  ),
  slack_user_id TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sprint_planning_jira_reports (
  jira_report_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sprint_planning_session_id BIGINT NOT NULL REFERENCES sprint_planning_sessions(sprint_planning_session_id) ON DELETE CASCADE,
  jira_sprint_id TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('mock_closed_story_points', 'closed_story_points', 'sprint_closure')),
  completed_story_points NUMERIC(8, 2) CHECK (completed_story_points >= 0),
  fetched_payload JSONB NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(fetched_payload) = 'object')
);

CREATE TABLE sprint_planning_workflow_steps (
  workflow_step_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sprint_planning_session_id BIGINT NOT NULL REFERENCES sprint_planning_sessions(sprint_planning_session_id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  owner TEXT NOT NULL CHECK (owner IN ('app', 'team', 'slack', 'jira')),
  status TEXT NOT NULL CHECK (status IN ('ready', 'blocked', 'connector-pending', 'done')),
  label TEXT NOT NULL,
  preview TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sprint_planning_session_id, step_key)
);

CREATE INDEX sprint_planning_sessions_team_config_id_idx
  ON sprint_planning_sessions (team_config_id);

CREATE INDEX sprint_planning_sessions_status_idx
  ON sprint_planning_sessions (planning_status);

CREATE INDEX sprint_planning_velocity_history_session_id_idx
  ON sprint_planning_velocity_history (sprint_planning_session_id);

CREATE INDEX sprint_planning_leave_confirmations_session_id_idx
  ON sprint_planning_leave_confirmations (sprint_planning_session_id);

CREATE INDEX sprint_planning_jira_reports_session_id_idx
  ON sprint_planning_jira_reports (sprint_planning_session_id);

CREATE INDEX sprint_planning_jira_reports_payload_gin_idx
  ON sprint_planning_jira_reports USING GIN (fetched_payload);

CREATE INDEX sprint_planning_workflow_steps_session_id_idx
  ON sprint_planning_workflow_steps (sprint_planning_session_id);
