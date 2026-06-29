"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Loader2, Users, Clock, DollarSign, Star } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import type { InsightPeriod } from "@/types/insights";
import type { TeamDashboardResponse, TeamMemberStats } from "@/types/team";

type SortKey = "total_meetings" | "total_hours" | "avg_score" | "completion_rate" | "last_meeting";

const PERIOD_OPTIONS: { value: InsightPeriod; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
];

function scoreColor(score: number) {
  if (score < 50) return "#EF4444";
  if (score < 75) return "#F59E0B";
  return "#10B981";
}

export function TeamDashboardClient() {
  const [period, setPeriod] = useState<InsightPeriod>("month");
  const [data, setData] = useState<TeamDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("total_meetings");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/team/dashboard?period=${period}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const sortedMembers = useMemo(() => {
    if (!data) return [];
    const members = [...data.members];
    members.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      const aVal = sortKey === "last_meeting" ? new Date(av as string).getTime() || -Infinity : (av as number);
      const bVal = sortKey === "last_meeting" ? new Date(bv as string).getTime() || -Infinity : (bv as number);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return members;
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const collaborationPeople = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const pair of data.collaboration_map) {
      set.add(pair.person_a);
      set.add(pair.person_b);
    }
    return Array.from(set).sort();
  }, [data]);

  function sharedMeetingsBetween(a: string, b: string): number {
    if (!data || a === b) return 0;
    const key = [a, b].sort().join("::");
    const pair = data.collaboration_map.find((p) => [p.person_a, p.person_b].sort().join("::") === key);
    return pair?.shared_meetings ?? 0;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Overview</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.members.length} team members` : "Loading team..."}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={period === opt.value ? "default" : "ghost"}
              size="sm"
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading team data...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total team meetings" value={data.team_totals.meetings} icon={Users} />
            <StatCard label="Total hours" value={`${data.team_totals.hours}h`} icon={Clock} />
            <StatCard label="Total cost" value={`£${data.team_totals.cost.toFixed(2)}`} icon={DollarSign} />
            <StatCard
              label="Avg score"
              value={data.team_totals.avg_score != null ? Math.round(data.team_totals.avg_score) : "—"}
              icon={Star}
            />
          </div>

          {data.back_to_back_warnings.length > 0 && (
            <div className="flex flex-col gap-2">
              {data.back_to_back_warnings.map((w, i) => (
                <Card key={i} className="border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)]">
                  <CardContent className="py-3 text-sm">
                    ⚠️ <span className="font-medium">{w.name ?? "A team member"}</span> had {w.count}{" "}
                    back-to-back meetings on {new Date(w.day).toLocaleDateString(undefined, { weekday: "long" })} —
                    consider blocking focus time.
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Member leaderboard</CardTitle>
              <CardDescription>Click a column to sort</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <SortableHead label="Meetings" sortKey="total_meetings" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableHead label="Hours" sortKey="total_hours" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableHead label="Avg Score" sortKey="avg_score" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableHead label="Completion Rate" sortKey="completion_rate" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortableHead label="Last Active" sortKey="last_meeting" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMembers.map((m) => (
                    <MemberRow key={m.id} member={m} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Collaboration map</CardTitle>
              <CardDescription>
                Based on attendee salaries entered for meetings — sparse until more meetings have attendees recorded
              </CardDescription>
            </CardHeader>
            <CardContent>
              {collaborationPeople.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Not enough data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `120px repeat(${collaborationPeople.length}, 1fr)` }}
                  >
                    <div />
                    {collaborationPeople.map((p) => (
                      <div key={p} className="truncate text-center text-xs text-muted-foreground">
                        {p}
                      </div>
                    ))}
                    {collaborationPeople.map((rowPerson) => (
                      <Fragment key={rowPerson}>
                        <div className="truncate text-xs text-muted-foreground">{rowPerson}</div>
                        {collaborationPeople.map((colPerson) => {
                          const count = sharedMeetingsBetween(rowPerson, colPerson);
                          return (
                            <div
                              key={`${rowPerson}-${colPerson}`}
                              title={`${rowPerson} & ${colPerson}: ${count} shared meeting${count === 1 ? "" : "s"}`}
                              className="flex aspect-square items-center justify-center rounded-sm text-[10px] text-white"
                              style={{
                                backgroundColor:
                                  rowPerson === colPerson ? "transparent" : `rgba(37, 99, 235, ${Math.min(count * 0.2, 0.9)})`,
                              }}
                            >
                              {rowPerson !== colPerson && count > 0 ? count : ""}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time in meetings</CardTitle>
              <CardDescription>Industry average: 35% of day in meetings</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.members.map((m) => {
                const pct = m.meeting_time_pct ?? 0;
                const color = pct > 50 ? "#EF4444" : pct > 25 ? "#F59E0B" : "#10B981";
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="w-32 truncate text-sm">{m.name ?? m.email}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <TableHead className="cursor-pointer select-none" onClick={() => onSort(sortKey)}>
      {label}
      {current === sortKey && <span className="ml-1 text-xs">{dir === "asc" ? "▲" : "▼"}</span>}
    </TableHead>
  );
}

function MemberRow({ member }: { member: TeamMemberStats }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: colorFromName(member.name ?? member.email) }}
          >
            {initialsFromName(member.name ?? member.email)}
          </div>
          <span className="font-medium">{member.name ?? member.email}</span>
        </div>
      </TableCell>
      <TableCell>{member.total_meetings}</TableCell>
      <TableCell>{member.total_hours}h</TableCell>
      <TableCell>
        {member.avg_score != null ? (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${scoreColor(member.avg_score)}1A`, color: scoreColor(member.avg_score) }}
          >
            {Math.round(member.avg_score)}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        {member.completion_rate != null ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${member.completion_rate}%`, backgroundColor: scoreColor(member.completion_rate) }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{member.completion_rate}%</span>
          </div>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {member.last_meeting ? new Date(member.last_meeting).toLocaleDateString() : "—"}
      </TableCell>
    </TableRow>
  );
}
