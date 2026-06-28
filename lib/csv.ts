export interface ActionItemRow {
  task: string;
  owner: string | null;
  deadline: string | null;
  priority: string;
  status: string;
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function actionItemsToCsv(items: ActionItemRow[]): string {
  const header = ["Task", "Owner", "Deadline", "Priority", "Status"];
  const rows = items.map((item) =>
    [item.task, item.owner ?? "", item.deadline ?? "", item.priority, item.status].map((cell) =>
      escapeCsvCell(cell)
    )
  );
  return [header, ...rows].map((row) => row.join(",")).join("\n");
}
