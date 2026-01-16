"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ArrowLeft, Download, Play, User, Bot, Clock, Loader2 } from "lucide-react";

interface TranscriptEntry {
  id: string;
  role: 'agent' | 'user';
  text: string;
  timestamp_ms: number;
}

interface TranscriptData {
  seminarId: string;
  studentName: string;
  studentId: string;
  assignmentName: string;
  language: string;
  duration: number;
  startedAt: string | null;
  endedAt: string | null;
  entries: TranscriptEntry[];
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins} min ${secs} sec`;
}

export default function TranscriptPage() {
  const params = useParams();
  const seminarId = params.id as string;

  const t = useTranslations("admin.transcript");
  const tc = useTranslations("common");

  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTranscript() {
      try {
        const res = await fetch(`/api/admin/seminars/${seminarId}/transcript`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch transcript');
        }
        const data = await res.json();
        setTranscript(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transcript');
      } finally {
        setLoading(false);
      }
    }

    fetchTranscript();
  }, [seminarId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !transcript) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/seminars">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("actions.backToSeminars")}
            </Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">{t("error")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'Transcript not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/seminars">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tc("actions.backToSeminars")}
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("seminarNumber", { id: seminarId })} - {transcript.studentName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Play className="mr-2 h-4 w-4" />
            {tc("actions.playRecording")}
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {tc("actions.export")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sessionDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("student")}</p>
              <p className="font-medium">{transcript.studentName}</p>
              <p className="text-sm text-muted-foreground">{transcript.studentId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("assignment")}</p>
              <p className="font-medium">{transcript.assignmentName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("language")}</p>
              <Badge variant="outline">
                {transcript.language === 'sv' ? `${tc("language.swedish").split(' ')[0]}` : `${tc("language.english")}`}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("duration")}</p>
              <p className="font-medium">{formatDuration(transcript.duration)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("conversationTranscript")}</CardTitle>
          <CardDescription>{t("fullTranscript")}</CardDescription>
        </CardHeader>
        <CardContent>
          {transcript.entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("noTranscript")}
            </p>
          ) : (
            <div className="space-y-4">
              {transcript.entries.map((entry, index) => (
                <div key={entry.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        entry.role === 'agent' ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        {entry.role === 'agent' ? (
                          <Bot className="h-5 w-5 text-primary" />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {entry.role === 'agent' ? t("examiner") : transcript.studentName}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimestamp(entry.timestamp_ms)}
                        </span>
                      </div>
                      <p className="text-sm">{entry.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("grading")}</CardTitle>
          <CardDescription>{t("gradingDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button asChild>
              <Link href={`/admin/grading?seminar=${seminarId}`}>
                {tc("actions.goToGrading")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
