import { BookWithAgentForm } from "@/components/scheduler/book-with-agent-form";

export default function BookWithAgentPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Book with an agent</h1>
        <p className="text-sm text-muted-foreground">
          Tell us who and how long — we&apos;ll check your calendar, propose open times, and let
          them pick one.
        </p>
      </div>
      <BookWithAgentForm />
    </div>
  );
}
