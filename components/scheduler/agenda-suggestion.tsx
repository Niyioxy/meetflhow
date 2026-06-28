"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Sparkles, Copy, CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AgendaItem, AgendaItemType, SuggestedAgenda } from "@/types/analysis";

const TYPE_STYLES: Record<AgendaItemType, string> = {
  update: "bg-[rgba(37,99,235,0.1)] text-[var(--blue-light)] border-[rgba(37,99,235,0.2)]",
  discussion: "bg-[rgba(168,85,247,0.1)] text-[#C084FC] border-[rgba(168,85,247,0.2)]",
  decision: "bg-[rgba(16,185,129,0.1)] text-[#34D399] border-[rgba(16,185,129,0.2)]",
  action_review: "bg-[rgba(245,158,11,0.1)] text-[#FBBF24] border-[rgba(245,158,11,0.2)]",
};

interface DraggableAgendaItem extends AgendaItem {
  id: string;
}

function formatAgendaAsText(agenda: SuggestedAgenda, items: DraggableAgendaItem[]): string {
  const lines = [
    `Suggested duration: ${agenda.suggested_duration} min`,
    "",
    "Agenda:",
    ...items.map(
      (item, i) => `${i + 1}. ${item.item} (${item.duration_minutes} min, ${item.type}) — ${item.notes}`
    ),
  ];
  if (agenda.goals.length > 0) {
    lines.push("", "Goals:", ...agenda.goals.map((g) => `- ${g}`));
  }
  if (agenda.pre_meeting_prep.length > 0) {
    lines.push("", "Pre-meeting prep:", ...agenda.pre_meeting_prep.map((p) => `- ${p}`));
  }
  return lines.join("\n");
}

export function AgendaSuggestion({
  title,
  attendees,
  scheduledAt,
  onAddToNotes,
}: {
  title: string;
  attendees: string[];
  scheduledAt: string;
  onAddToNotes: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [agenda, setAgenda] = useState<SuggestedAgenda | null>(null);
  const [items, setItems] = useState<DraggableAgendaItem[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  async function handleSuggest() {
    if (!title.trim()) {
      toast.error("Add a meeting title first");
      return;
    }

    setLoading(true);
    setAgenda(null);
    try {
      const res = await fetch("/api/meetings/suggest-agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          attendees,
          scheduled_at: scheduledAt || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const suggested: SuggestedAgenda = data.agenda;
      setAgenda(suggested);
      setItems(
        suggested.agenda_items.map((item, i) => ({ ...item, id: `agenda-item-${i}` }))
      );
    } catch {
      toast.error("Failed to generate an agenda suggestion");
    } finally {
      setLoading(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function handleCopy() {
    if (!agenda) return;
    await navigator.clipboard.writeText(formatAgendaAsText(agenda, items));
    toast.success("Agenda copied to clipboard");
  }

  function handleAddToInvite() {
    if (!agenda) return;
    onAddToNotes(formatAgendaAsText(agenda, items));
    toast.success("Agenda added to meeting notes");
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">AI agenda</p>
          <p className="text-xs text-muted-foreground">
            Suggests an agenda based on your recent meetings together
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleSuggest} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          AI Suggest Agenda
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {agenda && !loading && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Suggested duration: {agenda.suggested_duration} min
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {items.map((item, index) => (
                  <SortableAgendaItem
                    key={item.id}
                    item={item}
                    index={index}
                    onChange={(next) =>
                      setItems((prev) => prev.map((i) => (i.id === item.id ? next : i)))
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {agenda.goals.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Goals: </span>
              {agenda.goals.join(" · ")}
            </div>
          )}
          {agenda.pre_meeting_prep.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Prep: </span>
              {agenda.pre_meeting_prep.join(" · ")}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copy to clipboard
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleAddToInvite}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Add to calendar invite
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableAgendaItem({
  item,
  index,
  onChange,
}: {
  item: DraggableAgendaItem;
  index: number;
  onChange: (next: DraggableAgendaItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-md border border-border bg-card p-3"
    >
      <button
        type="button"
        className="mt-1 cursor-grab text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{index + 1}.</span>
          <Input
            value={item.item}
            onChange={(e) => onChange({ ...item, item: e.target.value })}
            className="h-7 flex-1 border-none bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-1"
          />
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-xs",
              TYPE_STYLES[item.type]
            )}
          >
            {item.type.replace("_", " ")}
          </span>
          <Input
            type="number"
            value={item.duration_minutes}
            onChange={(e) =>
              onChange({ ...item, duration_minutes: Number(e.target.value) || 0 })
            }
            className="h-7 w-16 shrink-0 text-center text-xs"
          />
          <span className="shrink-0 text-xs text-muted-foreground">min</span>
        </div>
        {item.notes && <p className="pl-5 text-xs text-muted-foreground">{item.notes}</p>}
      </div>
    </div>
  );
}
