import type { PRIORITIES } from "@/lib/constants";

type Priority = (typeof PRIORITIES)[number];

type ProjectContext = {
  id: string;
  title: string;
  priority: Priority;
  next_action?: string | null;
};

type DeliverableContext = {
  id: string;
  project_id?: string | null;
  title: string;
  status: string;
  priority: Priority;
  due_date?: string | null;
  completion_criteria?: string | null;
};

type ExistingAction = {
  title: string;
  status: string;
};

export type PreparedActionDraft = {
  source: "project_next_action" | "deliverable";
  project_id: string;
  deliverable_id?: string;
  title: string;
  priority: Priority;
  completion_criteria?: string;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("pt-PT").replace(/\s+/g, " ");
}

function alreadyExists(title: string, existingActions: ExistingAction[]) {
  const target = normalized(title);
  return existingActions.some(
    (action) =>
      !["completed", "cancelled"].includes(action.status) &&
      normalized(action.title) === target,
  );
}

export function prepareActionDraft(
  project: ProjectContext | undefined,
  deliverables: DeliverableContext[],
  existingActions: ExistingAction[],
): PreparedActionDraft | null {
  if (!project) return null;

  const projectNextAction = project.next_action?.trim();
  if (projectNextAction && !alreadyExists(projectNextAction, existingActions)) {
    return {
      source: "project_next_action",
      project_id: project.id,
      title: projectNextAction,
      priority: project.priority,
    };
  }

  const nextDeliverable = deliverables
    .filter(
      (item) =>
        item.project_id === project.id &&
        !["completed", "cancelled"].includes(item.status),
    )
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    })[0];

  if (!nextDeliverable) return null;

  const title = `Avançar ${nextDeliverable.title}`;
  if (alreadyExists(title, existingActions)) return null;

  return {
    source: "deliverable",
    project_id: project.id,
    deliverable_id: nextDeliverable.id,
    title,
    priority: nextDeliverable.priority,
    completion_criteria: nextDeliverable.completion_criteria?.trim() || undefined,
  };
}
