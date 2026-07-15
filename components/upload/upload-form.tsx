"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { PlatformSelect } from "@/components/upload/platform-select";
import { ContentTypeSelect } from "@/components/upload/content-type-select";
import { Loader2, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Switch } from "@/components/ui/switch";

function ShareWithWorkspaceToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { workspaces } = useWorkspace();
  if (workspaces.length === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <Label htmlFor="share-with-workspace" className="text-sm font-normal">
        Share with workspace
      </Label>
      <Switch id="share-with-workspace" checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function UploadForm() {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();

  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [filePlatform, setFilePlatform] = useState("other");
  const [fileContentType, setFileContentType] = useState("meeting");
  const [fileShared, setFileShared] = useState(false);
  const [fileSubmitting, setFileSubmitting] = useState(false);

  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedPlatform, setPastedPlatform] = useState("other");
  const [pastedContentType, setPastedContentType] = useState("meeting");
  const [pasteShared, setPasteShared] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [pasteSubmitting, setPasteSubmitting] = useState(false);

  async function handleFileSubmit() {
    if (!file) {
      toast.error("Select an audio or video file first");
      return;
    }
    setFileSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", fileTitle || file.name);
      formData.append("platform", filePlatform);
      formData.append("contentType", fileContentType);
      if (activeWorkspaceId) {
        formData.append("workspaceId", activeWorkspaceId);
        formData.append("sharedWithWorkspace", String(fileShared));
      }

      const res = await fetch("/api/meetings/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      toast.success("Meeting processed");
      router.push(`/meetings/${data.meetingId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setFileSubmitting(false);
    }
  }

  async function handlePasteSubmit() {
    if (!transcriptText.trim()) {
      toast.error("Paste a transcript first");
      return;
    }
    setPasteSubmitting(true);
    try {
      const res = await fetch("/api/meetings/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pastedTitle,
          platform: pastedPlatform,
          contentType: pastedContentType,
          transcriptText,
          ...(activeWorkspaceId
            ? { workspaceId: activeWorkspaceId, sharedWithWorkspace: pasteShared }
            : {}),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      toast.success("Transcript analyzed");
      router.push(`/meetings/${data.meetingId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setPasteSubmitting(false);
    }
  }

  return (
    <Tabs defaultValue="file" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="file">Audio / video file</TabsTrigger>
        <TabsTrigger value="paste">Paste transcript</TabsTrigger>
      </TabsList>

      <TabsContent value="file">
        <Card>
          <CardHeader>
            <CardTitle>Upload a recording</CardTitle>
            <CardDescription>
              We&apos;ll transcribe it with Deepgram and analyze it with Gemini automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FileDropzone file={file} onFileSelected={setFile} />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="file-title">Title</Label>
                <Input
                  id="file-title"
                  placeholder="Weekly sync"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Platform</Label>
                <PlatformSelect value={filePlatform} onChange={setFilePlatform} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Content type</Label>
                <ContentTypeSelect value={fileContentType} onChange={setFileContentType} />
              </div>
            </div>

            <ShareWithWorkspaceToggle checked={fileShared} onChange={setFileShared} />

            <Button onClick={handleFileSubmit} disabled={fileSubmitting || !file}>
              {fileSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transcribing & analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Process meeting
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="paste">
        <Card>
          <CardHeader>
            <CardTitle>Paste a transcript</CardTitle>
            <CardDescription>
              Already have a transcript from Zoom, Otter, or elsewhere? Paste it and we&apos;ll analyze it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="paste-title">Title</Label>
                <Input
                  id="paste-title"
                  placeholder="Weekly sync"
                  value={pastedTitle}
                  onChange={(e) => setPastedTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Platform</Label>
                <PlatformSelect value={pastedPlatform} onChange={setPastedPlatform} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Content type</Label>
                <ContentTypeSelect value={pastedContentType} onChange={setPastedContentType} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="transcript">Transcript</Label>
              <Textarea
                id="transcript"
                placeholder="Paste the full meeting transcript here..."
                className="min-h-[240px]"
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
              />
            </div>

            <ShareWithWorkspaceToggle checked={pasteShared} onChange={setPasteShared} />

            <Button onClick={handlePasteSubmit} disabled={pasteSubmitting || !transcriptText.trim()}>
              {pasteSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze transcript
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
