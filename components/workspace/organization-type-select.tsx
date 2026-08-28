"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ORGANIZATION_TYPE_OPTIONS = [
  { value: "general", label: "General (all content types)" },
  { value: "corporate", label: "Corporate (Meetings only)" },
  { value: "church", label: "Church (Sermons only)" },
  { value: "podcast", label: "Podcast (Podcasts only)" },
];

export function OrganizationTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Organization type" />
      </SelectTrigger>
      <SelectContent>
        {ORGANIZATION_TYPE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
