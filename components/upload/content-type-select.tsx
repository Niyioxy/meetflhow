"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const CONTENT_TYPE_OPTIONS = [
  { value: "meeting", label: "Meeting" },
  { value: "training", label: "Training / Seminar" },
  { value: "sermon", label: "Sermon" },
  { value: "podcast", label: "Podcast" },
];

export function ContentTypeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Content type" />
      </SelectTrigger>
      <SelectContent>
        {CONTENT_TYPE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
