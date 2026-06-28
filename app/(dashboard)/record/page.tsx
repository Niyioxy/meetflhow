import { Recorder } from "@/components/record/recorder";

export default function RecordPage({
  searchParams,
}: {
  searchParams: { title?: string; platform?: string };
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Record a meeting</h1>
        <p className="text-sm text-muted-foreground">
          Capture mic audio directly in your browser, then download it or send it for analysis.
        </p>
      </div>
      <Recorder initialTitle={searchParams.title} initialPlatform={searchParams.platform} />
    </div>
  );
}
