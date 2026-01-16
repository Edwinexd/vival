"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Clock, User, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface SeminarDetails {
  id: string;
  status: string;
  language: string;
  conversationId: string | null;
  studentName: string;
  studentUsername: string;
  assignmentName: string;
  assignmentId: string;
  submissionId: string;
  windowStart: string;
  windowEnd: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  in_progress: "default",
  completed: "secondary",
  booked: "outline",
  waiting: "outline",
  failed: "destructive",
  no_show: "destructive",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function SeminarMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const seminarId = params.id as string;

  const t = useTranslations("admin.seminarMonitor");
  const tc = useTranslations("common");

  const [seminar, setSeminar] = useState<SeminarDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveDuration, setLiveDuration] = useState(0);

  const fetchSeminar = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/seminars/${seminarId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch seminar');
      }
      const data = await res.json();
      setSeminar(data);

      // If seminar completed, redirect to transcript
      if (data.status === 'completed') {
        router.push(`/admin/seminars/${seminarId}/transcript`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load seminar');
    } finally {
      setLoading(false);
    }
  }, [seminarId, router]);

  useEffect(() => {
    fetchSeminar();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchSeminar, 5000);
    return () => clearInterval(interval);
  }, [fetchSeminar]);

  // Live duration timer
  useEffect(() => {
    if (seminar?.status === 'in_progress' && seminar.startedAt) {
      const startedAt = new Date(seminar.startedAt).getTime();

      const updateDuration = () => {
        setLiveDuration(Math.floor((Date.now() - startedAt) / 1000));
      };

      updateDuration();
      const interval = setInterval(updateDuration, 1000);
      return () => clearInterval(interval);
    } else if (seminar?.durationSeconds) {
      setLiveDuration(seminar.durationSeconds);
    }
  }, [seminar?.status, seminar?.startedAt, seminar?.durationSeconds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !seminar) {
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
            <CardTitle className="text-destructive">{tc("errors.loadFailed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'Seminar not found'}</p>
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
          <p className="text-muted-foreground">{seminar.studentName}</p>
        </div>
        <Badge
          variant={statusColors[seminar.status] || "secondary"}
          className="text-base px-4 py-1"
        >
          {seminar.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Live Status Card */}
      <Card className={seminar.status === 'in_progress' ? 'border-green-500 border-2' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {seminar.status === 'in_progress' ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                {t("liveSession")}
              </>
            ) : seminar.status === 'completed' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                {t("sessionCompleted")}
              </>
            ) : seminar.status === 'failed' ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                {t("sessionFailed")}
              </>
            ) : (
              t("sessionStatus")
            )}
          </CardTitle>
          <CardDescription>
            {seminar.status === 'in_progress' && t("monitoringDescription")}
            {seminar.status === 'booked' && t("notStartedYet")}
            {seminar.status === 'waiting' && t("waitingForSlot")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-4xl font-mono mb-2">
                <Clock className="h-8 w-8" />
                <span>{formatDuration(liveDuration)}</span>
              </div>
              <p className="text-muted-foreground">
                {seminar.status === 'in_progress' ? t("elapsed") : tc("time.duration")}
              </p>
            </div>
          </div>

          {seminar.status === 'in_progress' && (
            <div className="h-16 bg-muted rounded-lg flex items-center justify-center">
              <div className="flex items-center gap-1">
                {[...Array(30)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-green-500 rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 40 + 10}px`,
                      animationDelay: `${i * 50}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t("sessionDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("student")}</p>
                  <p className="font-medium">{seminar.studentName}</p>
                  <p className="text-sm text-muted-foreground">{seminar.studentUsername}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("assignment")}</p>
                  <p className="font-medium">{seminar.assignmentName}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("language")}</p>
                <Badge variant="outline" className="mt-1">
                  {seminar.language === 'sv' ? `${tc("language.swedish").split(' ')[0]}` : tc("language.english")}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">{t("conversationId")}</p>
                <p className="font-mono text-sm">{seminar.conversationId || '-'}</p>
              </div>

              {seminar.startedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">{t("startedAt")}</p>
                  <p className="text-sm">{new Date(seminar.startedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{tc("actions.label")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" asChild>
              <Link href={`/admin/submissions/${seminar.submissionId}`}>
                <FileText className="mr-2 h-4 w-4" />
                {tc("actions.viewSubmission")}
              </Link>
            </Button>

            {(seminar.status === 'completed' || seminar.status === 'failed') && (
              <Button variant="outline" asChild>
                <Link href={`/admin/seminars/${seminarId}/transcript`}>
                  <FileText className="mr-2 h-4 w-4" />
                  {tc("actions.transcript")}
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
