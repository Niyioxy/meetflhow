"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { meetingReportToCsv, type MeetingReportData } from "@/lib/csv";

export function DownloadReportButton({ report }: { report: MeetingReportData }) {
  function handleDownload() {
    const csv = meetingReportToCsv(report);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="mr-2 h-4 w-4" />
      Report
    </Button>
  );
}
