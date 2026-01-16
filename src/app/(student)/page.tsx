"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
import { Calendar, FileText, CheckCircle, Clock, Loader2, Play } from "lucide-react";

interface Assignment {
  id: string;
  name: string;
  course_code: string;
  course_name: string;
  submission_id: string | null;
  submission_status: string | null;
  has_booked_seminar: boolean;
}

interface Seminar {
  id: string;
  status: string;
  language: string;
  assignment_name: string;
  course_code: string;
  window_start: string;
  window_end: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-SE", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function canStartSeminar(seminar: Seminar): boolean {
  if (seminar.status !== "booked") return false;
  const now = new Date();
  const start = new Date(seminar.window_start);
  const end = new Date(seminar.window_end);
  return now >= start && now <= end;
}

function isUpcomingSeminar(seminar: Seminar): boolean {
  if (seminar.status !== "booked") return false;
  const now = new Date();
  const start = new Date(seminar.window_start);
  return now < start;
}

export default function StudentDashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations("student.dashboard");
  const tc = useTranslations("common");

  useEffect(() => {
    async function fetchData() {
      try {
        const [assignmentsRes, seminarsRes] = await Promise.all([
          fetch("/api/student/assignments"),
          fetch("/api/student/seminars"),
        ]);

        if (assignmentsRes.ok) {
          const data = await assignmentsRes.json();
          setAssignments(data.assignments);
        }

        if (seminarsRes.ok) {
          const data = await seminarsRes.json();
          setSeminars(data.seminars);
        }
      } catch {
        // Silent fail - will show empty state
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const reviewedCount = assignments.filter((a) => a.submission_status === "reviewed").length;
  const pendingCount = assignments.filter((a) => a.submission_status === "pending" || a.submission_status === "reviewing").length;
  const completedCount = assignments.filter((a) => a.submission_status === "seminar_completed" || a.submission_status === "approved").length;

  const upcomingSeminar = seminars.find(
    (s) => s.status === "booked" && new Date(s.window_start) > new Date()
  );

  function getStatusBadge(status: string | null) {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; labelKey: string }> = {
      pending: { variant: "secondary", labelKey: "pendingReview" },
      reviewing: { variant: "secondary", labelKey: "underReview" },
      reviewed: { variant: "default", labelKey: "readyToBook" },
      seminar_pending: { variant: "outline", labelKey: "seminarBooked" },
      seminar_completed: { variant: "default", labelKey: "seminarDone" },
      approved: { variant: "default", labelKey: "approved" },
      rejected: { variant: "destructive", labelKey: "rejected" },
    };
    const config = status ? statusConfig[status] : { variant: "secondary" as const, labelKey: "unknown" };
    return <Badge variant={config.variant}>{tc(`status.${config.labelKey}`)}</Badge>;
  }

  function getSeminarStatusBadge(status: string) {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; labelKey: string }> = {
      booked: { variant: "outline", labelKey: "scheduled" },
      waiting: { variant: "secondary", labelKey: "waiting" },
      in_progress: { variant: "default", labelKey: "inProgress" },
      completed: { variant: "default", labelKey: "completed" },
      failed: { variant: "destructive", labelKey: "failed" },
      no_show: { variant: "destructive", labelKey: "noShow" },
    };
    const config = statusConfig[status] || { variant: "secondary" as const, labelKey: status };
    return <Badge variant={config.variant}>{tc(`status.${config.labelKey}`)}</Badge>;
  }

  const getOverallStatus = () => {
    if (assignments.length === 0) return { variant: "secondary" as const, labelKey: "notStarted" };
    if (completedCount === assignments.length) return { variant: "default" as const, labelKey: "completed" };
    if (upcomingSeminar) return { variant: "outline" as const, labelKey: "seminarScheduled" };
    if (reviewedCount > 0) return { variant: "default" as const, labelKey: "readyToBook" };
    if (pendingCount > 0) return { variant: "secondary" as const, labelKey: "underReview" };
    return { variant: "secondary" as const, labelKey: "inProgress" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const overallStatus = getOverallStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("welcome")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("codeReviews")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviewedCount}</div>
            <p className="text-xs text-muted-foreground">{t("readyForSeminar")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("pendingReview")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">{t("awaitingAiReview")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("upcomingSeminar")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingSeminar ? (
              <>
                <div className="text-2xl font-bold">{formatDate(upcomingSeminar.window_start)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(upcomingSeminar.window_start)} - {formatTime(upcomingSeminar.window_end)}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">{t("noSeminarBooked")}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("status")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={overallStatus.variant}>{tc(`status.${overallStatus.labelKey}`)}</Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              {completedCount}/{assignments.length} {t("completed")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("yourSubmissions")}</CardTitle>
            <CardDescription>{t("submissionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="py-4 text-center">
                <p className="mb-4 text-sm text-muted-foreground">{t("noSubmissionsYet")}</p>
                <Badge variant="outline">{t("awaitingUpload")}</Badge>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {assignment.course_code}: {assignment.name}
                      </p>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      {getStatusBadge(assignment.submission_status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("quickActions")}</CardTitle>
            <CardDescription>{t("quickActionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/book-seminar">
                <Calendar className="mr-2 h-4 w-4" />
                {t("bookSeminarSlot")}
                {reviewedCount > 0 && (
                  <Badge variant="default" className="ml-auto">
                    {t("ready", { count: reviewedCount })}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/results">
                <CheckCircle className="mr-2 h-4 w-4" />
                {tc("actions.viewResults")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {seminars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("yourSeminars")}</CardTitle>
            <CardDescription>{t("yourSeminarsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {seminars.map((seminar) => (
                <div
                  key={seminar.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {seminar.course_code}: {seminar.assignment_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(seminar.window_start)} {formatTime(seminar.window_start)} - {formatTime(seminar.window_end)}
                      {" · "}
                      {seminar.language === "sv" ? "Svenska" : "English"}
                    </p>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-2">
                    {canStartSeminar(seminar) && (
                      <Button size="sm" asChild>
                        <Link href={`/seminar/${seminar.id}`}>
                          <Play className="mr-1 h-4 w-4" />
                          {t("startSeminar")}
                        </Link>
                      </Button>
                    )}
                    {getSeminarStatusBadge(seminar.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
