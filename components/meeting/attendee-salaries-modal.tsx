"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencyEnum, type AttendeeSalary, type CalculatedCost } from "@/types/cost";

interface Row {
  name: string;
  email: string;
  annual_salary: string;
}

export function AttendeeSalariesModal({
  meetingId,
  initialAttendees,
  suggestedNames,
  onSaved,
}: {
  meetingId: string;
  initialAttendees: AttendeeSalary[] | null;
  suggestedNames: string[];
  onSaved: (cost: CalculatedCost | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState(initialAttendees?.[0]?.currency ?? "GBP");
  const [rows, setRows] = useState<Row[]>(
    initialAttendees && initialAttendees.length > 0
      ? initialAttendees.map((a) => ({
          name: a.name,
          email: a.email,
          annual_salary: String(a.annual_salary),
        }))
      : suggestedNames.length > 0
        ? suggestedNames.map((name) => ({ name, email: "", annual_salary: "" }))
        : [{ name: "", email: "", annual_salary: "" }]
  );
  const [saving, setSaving] = useState(false);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { name: "", email: "", annual_salary: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const attendees: AttendeeSalary[] = [];
    for (const row of rows) {
      if (!row.name.trim() || !row.email.trim() || !row.annual_salary.trim()) continue;
      const salary = Number(row.annual_salary);
      if (!Number.isFinite(salary) || salary <= 0) continue;
      attendees.push({
        name: row.name.trim(),
        email: row.email.trim(),
        annual_salary: salary,
        currency,
      });
    }

    if (attendees.length === 0) {
      toast.error("Add at least one attendee with a name, email, and salary");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendee-salaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendees }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save salaries");
      }
      const data = await res.json();
      toast.success("Attendee salaries saved");
      onSaved(data.calculatedCost ?? null);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add Salaries
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attendee salaries</DialogTitle>
          <DialogDescription>
            Used to estimate this meeting&apos;s real cost. Stored only against this meeting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyEnum.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Name"
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Email"
                  value={row.email}
                  onChange={(e) => updateRow(i, { email: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Annual salary"
                  type="number"
                  value={row.annual_salary}
                  onChange={(e) => updateRow(i, { annual_salary: e.target.value })}
                  className="w-32"
                />
                <Button variant="ghost" size="icon-sm" onClick={() => removeRow(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="self-start">
              <Plus className="mr-2 h-4 w-4" />
              Add attendee
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
