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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Award, FileText, MessageSquare, Clock } from "lucide-react";
import { toast } from "sonner";

interface Result {
  submission_id: string;
  assignment_id: string;
  assignment_name: string;
  course_code: string;
  course_name: string;
  submission_status: string;
  uploaded_at: string;
  has_review: boolean;
  seminar_status: string | null;
  seminar_duration: number | null;
  seminar_language: string | null;
  final_grade: string | null;
  student_feedback: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ResultsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  const t = useTranslations("student.results");
  const tc = useTranslations("common");

  useEffect(() => {
    fetch("/api/student/results")
      .then((res) => res.json())
      .then((data) => {
        if (data.results) {
          setResults(data.results);
        }
      })
      .catch(() => {
        toast.error(tc("errors.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [tc]);

  function getGradeBadge(grade: string | null) {
    if (!grade) return null;
    const gradeColors: Record<string, "default" | "secondary" | "destructive"> = {
      A: "default",
      B: "default",
      C: "default",
      D: "secondary",
      E: "secondary",
      F: "destructive",
      P: "default",
    };
    return (
      <Badge variant={gradeColors[grade] || "secondary"} className="text-lg px-3 py-1">
        {grade}
      </Badge>
    );
  }

  function getStatusBadge(status: string | null) {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; labelKey: string }> = {
      pending: { variant: "secondary", labelKey: "pending" },
      reviewing: { variant: "secondary", labelKey: "underReview" },
      reviewed: { variant: "outline", labelKey: "reviewed" },
      seminar_pending: { variant: "outline", labelKey: "seminarScheduled" },
      seminar_completed: { variant: "default", labelKey: "seminarDone" },
      approved: { variant: "default", labelKey: "approved" },
      rejected: { variant: "destructive", labelKey: "rejected" },
    };
    const config = status ? statusConfig[status] : { variant: "secondary" as const, labelKey: "unknown" };
    return <Badge variant={config.variant}>{tc(`status.${config.labelKey}`)}</Badge>;
  }

  function getSeminarStatusBadge(status: string | null) {
    if (!status) return <span className="text-muted-foreground">-</span>;
    const statusConfig: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; labelKey: string }> = {
      booked: { variant: "outline", labelKey: "booked" },
      waiting: { variant: "secondary", labelKey: "waiting" },
      in_progress: { variant: "secondary", labelKey: "inProgress" },
      completed: { variant: "default", labelKey: "completed" },
      failed: { variant: "destructive", labelKey: "failed" },
      no_show: { variant: "destructive", labelKey: "noShow" },
    };
    const config = statusConfig[status] || { variant: "secondary" as const, labelKey: status };
    return <Badge variant={config.variant}>{tc(`status.${config.labelKey}`)}</Badge>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gradedResults = results.filter((r) => r.final_grade);
  const pendingResults = results.filter((r) => !r.final_grade);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{t("noResultsYet")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("noResultsDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("totalSubmissions")}</CardDescription>
                <CardTitle className="text-3xl">{results.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("graded")}</CardDescription>
                <CardTitle className="text-3xl">{gradedResults.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("seminarsCompleted")}</CardDescription>
                <CardTitle className="text-3xl">
                  {results.filter((r) => r.seminar_status === "completed").length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {gradedResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  {t("finalGrades")}
                </CardTitle>
                <CardDescription>{t("finalGradesDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {gradedResults.map((result) => (
                    <div
                      key={result.submission_id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {result.course_code}: {result.assignment_name}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {result.course_name}
                          </p>
                        </div>
                        <div className="text-right">
                          {getGradeBadge(result.final_grade)}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{t("seminar")}</p>
                          {getSeminarStatusBadge(result.seminar_status)}
                          {result.seminar_duration && (
                            <p className="text-sm text-muted-foreground">
                              {tc("time.duration")}: {formatDuration(result.seminar_duration)}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{t("submitted")}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(result.uploaded_at)}
                          </p>
                        </div>
                      </div>

                      {result.student_feedback && (
                        <div className="mt-4 rounded-md bg-muted p-3">
                          <p className="text-sm font-medium mb-1">
                            <MessageSquare className="inline h-4 w-4 mr-1" />
                            {t("feedback")}
                          </p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {result.student_feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {pendingResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t("inProgress")}
                </CardTitle>
                <CardDescription>{t("inProgressDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("assignment")}</TableHead>
                      <TableHead>{tc("status.pending")}</TableHead>
                      <TableHead>{t("seminar")}</TableHead>
                      <TableHead>{t("submitted")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingResults.map((result) => (
                      <TableRow key={result.submission_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {result.course_code}: {result.assignment_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {result.course_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(result.submission_status)}
                        </TableCell>
                        <TableCell>
                          {getSeminarStatusBadge(result.seminar_status)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(result.uploaded_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
