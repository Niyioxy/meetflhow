"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { upload } from "@vercel/blob/client";
import { webUploadPath } from "@/lib/blob-urls";
import { apiError, toastApiError } from "@/lib/plan-limit-client";
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
import { ShareWithWorkspaceToggle } from "@/components/upload/share-with-workspace-toggle";
import { ALLOWED_CONTENT_TYPES } from "@/lib/organization-types";
import type { OrganizationType } from "@/db/schema";

export function UploadForm() {
  const router = useRouter();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const userId = useSession().data?.user?.id;
  const allowedContentTypes =
    ALLOWED_CONTENT_TYPES[(activeWorkspace?.organization_type as OrganizationType) ?? "general"];

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

  // If the active workspace changes to one that restricts content types,
  // fall back to whatever's still allowed rather than submitting a type
  // the server will reject.
  useEffect(() => {
    if (!allowedContentTypes.includes(fileContentType as (typeof allowedContentTypes)[number])) {
      setFileContentType(allowedContentTypes[0]);
    }
    if (!allowedContentTypes.includes(pastedContentType as (typeof allowedContentTypes)[number])) {
      setPastedContentType(allowedContentTypes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedContentTypes]);

  async function handleFileSubmit() {
    if (!file) {
      toast.error("Select an audio or video file first");
      return;
    }
    setFileSubmitting(true);
    try {
      if (!userId) throw new Error("Still signing you in — try again in a moment");
      const blob = await upload(webUploadPath(userId, file.name), file, {
        access: "public",
        handleUploadUrl: "/api/meetings/upload-token",
        multipart: true,
      });

      const res = await fetch("/api/meetings/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: blob.url,
          title: fileTitle || file.name,
          platform: filePlatform,
          contentType: fileContentType,
          ...(activeWorkspaceId
            ? { workspaceId: activeWorkspaceId, sharedWithWorkspace: fileShared }
            : {}),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw apiError(data, "Upload failed");
      }

      toast.success("Meeting processed");
      router.push(`/meetings/${data.meetingId}`);
      router.refresh();
    } catch (error) {
      toastApiError(error, router.push);
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
        throw apiError(data, "Analysis failed");
      }

      toast.success("Transcript analyzed");
      router.push(`/meetings/${data.meetingId}`);
      router.refresh();
    } catch (error) {
      toastApiError(error, router.push);
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
              We&apos;ll transcribe and analyze it automatically.
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
                <ContentTypeSelect
                  value={fileContentType}
                  onChange={setFileContentType}
                  allowedTypes={allowedContentTypes}
                />
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
                <ContentTypeSelect
                  value={pastedContentType}
                  onChange={setPastedContentType}
                  allowedTypes={allowedContentTypes}
                />
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
