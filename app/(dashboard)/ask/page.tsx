"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Citation {
  meetingId: string;
  title: string;
  createdAt: string;
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);

  async function handleAsk() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer(null);
    setCitations([]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAnswer(data.answer);
      setCitations(data.citations ?? []);
    } catch {
      toast.error("Failed to answer your question");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ask your meetings</h1>
        <p className="text-sm text-muted-foreground">
          Ask a question across all of your past meetings and get an answer with sources.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What did we decide about pricing last quarter?"
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={handleAsk} disabled={loading || !question.trim()}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Ask
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-6 w-full rounded-md" />
          ))}
        </div>
      )}

      {answer && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Answer</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="whitespace-pre-wrap text-sm">{answer}</p>
            {citations.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Sources</p>
                <div className="flex flex-col gap-1">
                  {citations.map((c) => (
                    <Link
                      key={c.meetingId}
                      href={`/meetings/${c.meetingId}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {c.title} — {new Date(c.createdAt).toLocaleDateString()}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
