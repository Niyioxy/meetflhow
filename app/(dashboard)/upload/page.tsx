import { UploadForm } from "@/components/upload/upload-form";

export default function UploadPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload a meeting</h1>
        <p className="text-sm text-muted-foreground">
          Drop an audio/video file or paste a transcript — MeetFlhow handles the rest.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
