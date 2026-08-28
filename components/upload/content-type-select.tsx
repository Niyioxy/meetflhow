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
  allowedTypes,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Restricts the visible options (e.g. by the active workspace's organization type). Defaults to all. */
  allowedTypes?: readonly string[];
}) {
  const options = allowedTypes
    ? CONTENT_TYPE_OPTIONS.filter((o) => allowedTypes.includes(o.value))
    : CONTENT_TYPE_OPTIONS;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Content type" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
