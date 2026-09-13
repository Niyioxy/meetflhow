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

export interface MeetingReportData {
  title: string;
  date: string;
  platform: string;
  durationMinutes: number | null;
  sentiment: string | null;
  summary: string | null;
  primaryPointsLabel: string;
  primaryPoints: string[];
  openQuestions: string[];
  actionItems: ActionItemRow[];
}

function csvRow(cells: (string | number)[]): string {
  return cells.map((cell) => escapeCsvCell(String(cell))).join(",");
}

/**
 * A full meeting writeup as CSV — not just the action items table
 * (actionItemsToCsv above), but the summary, decisions/takeaways, open
 * questions, and action items together, so there's one file that reads
 * like an actual report when opened in Excel/Sheets rather than several
 * separate exports.
 */
export function meetingReportToCsv(data: MeetingReportData): string {
  const sections: string[] = [];

  const header = [csvRow(["Meeting Report"]), csvRow(["Title", data.title]), csvRow(["Date", data.date]), csvRow(["Platform", data.platform])];
  if (data.durationMinutes != null) header.push(csvRow(["Duration (min)", data.durationMinutes]));
  if (data.sentiment) header.push(csvRow(["Sentiment", data.sentiment]));
  sections.push(header.join("\n"));

  if (data.summary) {
    sections.push([csvRow(["Summary"]), csvRow([data.summary])].join("\n"));
  }

  if (data.primaryPoints.length > 0) {
    sections.push(
      [csvRow([data.primaryPointsLabel]), ...data.primaryPoints.map((p) => csvRow([p]))].join("\n")
    );
  }

  if (data.openQuestions.length > 0) {
    sections.push(
      [csvRow(["Open Questions"]), ...data.openQuestions.map((q) => csvRow([q]))].join("\n")
    );
  }

  if (data.actionItems.length > 0) {
    sections.push([csvRow(["Action Items"]), actionItemsToCsv(data.actionItems)].join("\n"));
  }

  return sections.join("\n\n");
}
