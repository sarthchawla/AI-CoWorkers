import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Stepper,
  Table,
  Text,
  ThemeIcon,
  Title
} from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Copy, FolderOpen, Goal, ListChecks, MessageSquare } from "lucide-react";
import type {
  AutomationStep,
  LeaveConfirmationRow,
  PlanningResult,
  SavedSprintPlanningSessionSummary,
  VelocityHistoryRow,
  WorkflowStepId,
  WorkflowStepState
} from "./sprintPlanningTypes";

export type WorkflowStepDefinition = {
  id: WorkflowStepId;
  title: string;
  description: string;
  primaryAction: string;
  connector?: "jira" | "slack";
};

const statusLabels: Record<AutomationStep["status"], string> = {
  ready: "Ready",
  "connector-pending": "Connector pending",
  "team-input": "Team input",
  "replaced-by-app": "Excel replaced",
  done: "Done"
};

function statusColor(status: string) {
  if (status === "published" || status === "finalized" || status === "done") {
    return "teal";
  }

  if (status === "ready_for_review" || status === "ready") {
    return "blue";
  }

  if (status === "connector-pending" || status === "pending") {
    return "yellow";
  }

  return "gray";
}

export function formatSavedAt(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function toPerDeveloperVelocity(value: number, teamMemberCount: number) {
  return teamMemberCount > 0 ? Math.round((value / teamMemberCount) * 10) / 10 : 0;
}

export function SectionHeading({
  icon: Icon,
  title,
  description
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <Group gap="sm" align="flex-start">
      <ThemeIcon variant="light" color="teal" size={34} radius="md">
        <Icon size={18} aria-hidden="true" />
      </ThemeIcon>
      <Box>
        <Title order={2} size="h3">
          {title}
        </Title>
        {description ? (
          <Text size="sm" c="dimmed" mt={2}>
            {description}
          </Text>
        ) : null}
      </Box>
    </Group>
  );
}

export function PlanningStatusBadge({ status }: { status: string }) {
  return (
    <Badge color={statusColor(status)} variant="light" tt="capitalize">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function SourceBadge({ source }: { source: VelocityHistoryRow["source"] | LeaveConfirmationRow["source"] }) {
  const label =
    source === "mock-jira-report"
      ? "Jira preview"
      : source === "jira_report"
        ? "Real Jira"
        : source === "mock-slack-thread"
          ? "Slack preview"
          : source === "slack_thread"
            ? "Real Slack"
            : "Manual";

  return (
    <Badge variant="outline" color={source === "manual" ? "gray" : "teal"} size="xs">
      {label}
    </Badge>
  );
}

export function MetricBlock({
  label,
  value,
  caption,
  dominant = false
}: {
  label: string;
  value: number | string;
  caption?: string;
  dominant?: boolean;
}) {
  return (
    <Paper withBorder radius="md" p={dominant ? "lg" : "md"} className={dominant ? "metric-dominant" : undefined}>
      <Text size="xs" c="dimmed" fw={700} tt="uppercase">
        {label}
      </Text>
      <Text fw={800} fz={dominant ? 44 : 24} lh={1.05} mt={6}>
        {value}
      </Text>
      {caption ? (
        <Text size="sm" c="dimmed" mt={4}>
          {caption}
        </Text>
      ) : null}
    </Paper>
  );
}

export function SprintPlanCard({
  session,
  onOpen,
  onClone
}: {
  session: SavedSprintPlanningSessionSummary;
  onOpen: () => void;
  onClone: () => void;
}) {
  return (
    <Card withBorder radius="md" p="lg" shadow="xs">
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <Box>
          <Group gap="xs" mb={8}>
            <PlanningStatusBadge status={session.planningStatus} />
            <Text size="sm" c="dimmed">
              {session.currentSprintDates.start} to {session.currentSprintDates.end}
            </Text>
          </Group>
          <Title order={3} size="h3">
            {session.currentSprintName}
          </Title>
          <Text size="sm" c="dimmed">
            Previous {session.previousSprintName} · Updated {formatSavedAt(session.updatedAt)}
          </Text>
        </Box>
        <Group gap="xs" visibleFrom="sm">
          <Button variant="default" leftSection={<FolderOpen size={16} />} onClick={onOpen}>
            {session.planningStatus === "published" || session.planningStatus === "finalized" ? "Review" : "Continue"}
          </Button>
          <Button variant="light" leftSection={<Copy size={16} />} onClick={onClone}>
            Clone
          </Button>
        </Group>
      </Group>

      <Group mt="lg" gap="md" align="stretch">
        <Box className="plan-card-primary-metric">
          <Text fw={800} fz={30} lh={1}>
            {session.sprintVelocityPerDeveloper}
          </Text>
          <Text size="sm" c="dimmed">
            net velocity/dev
          </Text>
        </Box>
        <Divider orientation="vertical" />
        <Box>
          <Text fw={700}>{session.sprintVelocity}</Text>
          <Text size="sm" c="dimmed">
            total net velocity
          </Text>
        </Box>
        <Box>
          <Text fw={700}>{session.pendingLeaveConfirmations}</Text>
          <Text size="sm" c="dimmed">
            pending leaves
          </Text>
        </Box>
      </Group>

      <Group gap="xs" mt="md" hiddenFrom="sm">
        <Button variant="default" leftSection={<FolderOpen size={16} />} onClick={onOpen} fullWidth>
          {session.planningStatus === "published" || session.planningStatus === "finalized" ? "Review" : "Continue"}
        </Button>
        <Button variant="light" leftSection={<Copy size={16} />} onClick={onClone} fullWidth>
          Clone
        </Button>
      </Group>
    </Card>
  );
}

export function WorkflowStepper({
  steps,
  activeStepId,
  getState,
  onStepClick,
  mobile
}: {
  steps: WorkflowStepDefinition[];
  activeStepId: WorkflowStepId;
  getState: (stepId: WorkflowStepId) => WorkflowStepState;
  onStepClick: (stepId: WorkflowStepId) => void;
  mobile: boolean;
}) {
  const active = Math.max(
    steps.findIndex((step) => step.id === activeStepId),
    0
  );

  return (
    <Stepper
      active={active}
      onStepClick={(stepIndex) => onStepClick(steps[stepIndex].id)}
      orientation={mobile ? "horizontal" : "vertical"}
      size="sm"
      allowNextStepsSelect={false}
      wrap={false}
      className="workflow-stepper"
    >
      {steps.map((step) => {
        const state = getState(step.id);

        return (
          <Stepper.Step
            key={step.id}
            label={step.title}
            description={mobile ? undefined : state === "locked" ? "Locked" : state.replaceAll("_", " ")}
            allowStepSelect={state !== "locked"}
          />
        );
      })}
    </Stepper>
  );
}

export function VelocityHistoryEditor({
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
    <Stack gap="xs">
      <ScrollArea>
        <Table verticalSpacing="sm" striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Sprint</Table.Th>
              <Table.Th>Net velocity/dev</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.sprintOffset}>
                <Table.Th>
                  <Text fw={700}>
                    {row.sprintOffset === -1 ? "Last closed sprint" : `${Math.abs(row.sprintOffset)} sprints ago`}
                  </Text>
                  <Group gap={6} mt={4}>
                    <Text size="sm" c="dimmed">
                      {row.sprintName} · {row.netVelocity} total · {row.completedStoryPoints} completed SP ·{" "}
                      {row.leaveDays} leave days
                    </Text>
                    <SourceBadge source={row.source} />
                  </Group>
                </Table.Th>
                <Table.Td>
                  <NumberInput
                    aria-label={`Net velocity per developer for ${row.sprintOffset === -1 ? "last closed sprint" : `${Math.abs(row.sprintOffset)} sprints ago`}`}
                    min={0}
                    step={0.5}
                    value={toPerDeveloperVelocity(row.netVelocity, teamMemberCount)}
                    onChange={(value) =>
                      onChange(row.sprintOffset, "netVelocity", String(Number(value || 0) * teamMemberCount))
                    }
                    w={150}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Text size="sm" c="dimmed">
        Average is calculated from the three sprint net velocity/dev values. Jira import updates editable rows before
        the SM finalizes the target.
      </Text>
    </Stack>
  );
}

export function LeaveConfirmationEditor({
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
    <Stack gap="xs">
      <ScrollArea>
        <Table verticalSpacing="sm" striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Teammate</Table.Th>
              <Table.Th>Previous sprint</Table.Th>
              <Table.Th>Upcoming sprint</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.slackUserId}>
                <Table.Th>
                  <Text fw={700}>{row.teammateName}</Text>
                  <Group gap={6} mt={4}>
                    <Text size="sm" c="dimmed">
                      {row.confirmationStatus.replaceAll("_", " ")}
                    </Text>
                    <SourceBadge source={row.source} />
                  </Group>
                </Table.Th>
                <Table.Td>
                  <NumberInput
                    aria-label={`Previous sprint leave days for ${row.teammateName}`}
                    min={0}
                    step={0.5}
                    value={row.previousSprintLeaveDays}
                    onChange={(value) => onChange(row.slackUserId, "previousSprintLeaveDays", String(value || 0))}
                    w={150}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    aria-label={`Upcoming sprint leave days for ${row.teammateName}`}
                    min={0}
                    step={0.5}
                    value={row.upcomingSprintLeaveDays}
                    onChange={(value) => onChange(row.slackUserId, "upcomingSprintLeaveDays", String(value || 0))}
                    w={150}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Text size="sm" c="dimmed">
        Table totals update the previous and upcoming leave days used in capacity and Slack previews.
      </Text>
    </Stack>
  );
}

export function WorkflowSummary({
  summaryVelocityPerDeveloper,
  summaryVelocity,
  planning,
  workflowChecklist,
  slackPreview
}: {
  summaryVelocityPerDeveloper: number;
  summaryVelocity: number;
  planning: PlanningResult;
  workflowChecklist: Array<{ id: string; status: string; label: string; owner?: string }>;
  slackPreview: string;
}) {
  return (
    <Stack gap="md" className="workflow-summary">
      <MetricBlock
        label="Net velocity/dev"
        value={summaryVelocityPerDeveloper}
        caption={`${summaryVelocity} total sprint net velocity`}
        dominant
      />
      <Paper withBorder radius="md" p="md">
        <SectionHeading icon={Goal} title="Velocity summary" />
        <Stack gap="xs" mt="md">
          <MetricRow label="Average net velocity/dev" value={planning.averageNetVelocityPerDeveloper} />
          <MetricRow label="Capacity-adjusted net velocity/dev" value={planning.capacityAdjustedVelocityPerDeveloper} />
          <MetricRow label="Available capacity days" value={planning.availableCapacityDays} />
        </Stack>
      </Paper>
      <Paper withBorder radius="md" p="md">
        <SectionHeading icon={ListChecks} title="Workflow status" />
        <Stack gap="sm" mt="md">
          {workflowChecklist.map((step) => (
            <Group key={step.id} gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon color={statusColor(step.status)} variant="light" size={28} radius="xl">
                <CheckCircle2 size={15} aria-hidden="true" />
              </ThemeIcon>
              <Box>
                <Text size="sm" fw={650}>
                  {step.label}
                </Text>
                <Text size="xs" c="dimmed">
                  {step.owner ? `${step.owner} · ` : ""}
                  {statusLabels[step.status as AutomationStep["status"]] ?? step.status}
                </Text>
              </Box>
            </Group>
          ))}
        </Stack>
      </Paper>
      <Paper withBorder radius="md" p="md">
        <SectionHeading icon={MessageSquare} title="Slack preview" />
        <Text component="pre" className="preview-block" mt="md">
          {slackPreview}
        </Text>
      </Paper>
    </Stack>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={750}>{value}</Text>
    </Group>
  );
}
