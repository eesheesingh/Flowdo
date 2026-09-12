type Meta = Record<string, unknown> | null;

function str(meta: Meta, key: string): string {
  const v = meta?.[key];
  return typeof v === "string" ? v : "";
}

export function describeActivity(row: { action: string; metadata: Meta }): string {
  const { action, metadata } = row;
  switch (action) {
    case "task.created":
      return `Created "${str(metadata, "title")}"`;
    case "task.completed":
      return "Completed this task";
    case "task.reopened":
      return "Reopened this task";
    case "task.updated":
      return "Updated this task";
    case "task.deleted":
      return `Deleted "${str(metadata, "title")}"`;
    case "project.created":
      return `Created project "${str(metadata, "name")}"`;
    case "project.updated":
      return "Updated this project";
    case "project.archived":
      return "Archived this project";
    case "project.deleted":
      return `Deleted project "${str(metadata, "name")}"`;
    default:
      return action;
  }
}
