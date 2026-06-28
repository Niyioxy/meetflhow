"use client";

import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { FileAudio, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = ["audio/", "video/"];

function isAcceptedFile(file: File) {
  return ACCEPTED_TYPES.some((prefix) => file.type.startsWith(prefix));
}

export function FileDropzone({
  file,
  onFileSelected,
}: {
  file: File | null;
  onFileSelected: (file: File | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && isAcceptedFile(dropped)) {
      onFileSelected(dropped);
    }
  }

  if (file) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <FileAudio className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onFileSelected(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/30"
      )}
    >
      <UploadCloud className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="font-medium">Drag & drop an audio or video file</p>
        <p className="text-sm text-muted-foreground">or click to browse — MP3, WAV, M4A, MP4...</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected && isAcceptedFile(selected)) {
            onFileSelected(selected);
          }
        }}
      />
    </div>
  );
}
