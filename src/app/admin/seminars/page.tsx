"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Calendar, Clock, Users, Eye, FileText, Loader2, UserX } from "lucide-react";
import { toast } from "sonner";

interface Seminar {
  id: string;
  student_name: string;
  student_username: string;
  assignment_name: string;
  status: string;
  language: string;
  window_start: string;
  window_end: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  booked_at: string;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  in_progress: "default",
  completed: "secondary",
  booked: "outline",
  waiting: "outline",
  failed: "destructive",
  no_show: "destructive",
};

function formatSlotTime(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`;
}

function getDurationMinutes(seminar: Seminar): number | null {
  if (seminar.duration_seconds) {
    return Math.round(seminar.duration_seconds / 60);
  }
  if (seminar.started_at && seminar.status === "in_progress") {
    const startedAt = new Date(seminar.started_at);
    return Math.round((Date.now() - startedAt.getTime()) / 60000);
  }
  return null;
}

export default function AdminSeminarsPage() {
  const t = useTranslations("admin.seminars");
  const tc = useTranslations("common");
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingNoShow, setMarkingNoShow] = useState<string | null>(null);

  async function fetchSeminars() {
    try {
      const res = await fetch("/api/admin/seminars");
      if (!res.ok) {
        throw new Error("Failed to fetch seminars");
      }
      const data = await res.json();
      setSeminars(data.seminars);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSeminars();
    // Refresh every 30 seconds for active seminars
    const interval = setInterval(fetchSeminars, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleMarkNoShow(seminarId: string) {
    setMarkingNoShow(seminarId);
    try {
      const res = await fetch(`/api/admin/seminars/${seminarId}/no-show`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to mark as no-show");
      }
      toast.success(t("markedNoShow"));
      await fetchSeminars();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as no-show");
    } finally {
      setMarkingNoShow(null);
    }
  }

  function canMarkNoShow(seminar: Seminar): boolean {
    if (!["booked", "waiting"].includes(seminar.status)) return false;
    const now = new Date();
    const windowEnd = new Date(seminar.window_end);
    return now > windowEnd;
  }

  const activeSeminars = seminars.filter((s) => s.status === "in_progress");
  const upcomingSeminars = seminars.filter((s) => s.status === "booked" || s.status === "waiting");
  const completedToday = seminars.filter((s) => {
    if (s.status !== "completed" && s.status !== "failed") return false;
    if (!s.ended_at) return false;
    const endedAt = new Date(s.ended_at);
    const today = new Date();
    return endedAt.toDateString() === today.toDateString();
  });

  const avgDuration = completedToday.length > 0
    ? Math.round(
        completedToday.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) /
          completedToday.length /
          60
      )
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activeNow")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSeminars.length}</div>
            <p className="text-xs text-muted-foreground">{t("seminarsInProgress")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("upcoming")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingSeminars.length}</div>
            <p className="text-xs text-muted-foreground">{t("bookedSessions")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("completedToday")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedToday.length}</div>
            <p className="text-xs text-muted-foreground">{t("sessionsCompleted")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("avgDuration")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDuration > 0 ? `${avgDuration} min` : "-"}</div>
            <p className="text-xs text-muted-foreground">{t("avgSessionLength")}</p>
          </CardContent>
        </Card>
      </div>

      {activeSeminars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              {t("activeSeminars")}
            </CardTitle>
            <CardDescription>{t("currentlyRunning")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>{t("language")}</TableHead>
                  <TableHead>{tc("time.duration")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSeminars.map((seminar) => {
                  const duration = getDurationMinutes(seminar);
                  return (
                    <TableRow key={seminar.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{seminar.student_name}</p>
                          <p className="text-sm text-muted-foreground">{seminar.student_username}</p>
                        </div>
                      </TableCell>
                      <TableCell>{seminar.assignment_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {seminar.language === "sv"
                            ? `🇸🇪 ${tc("language.swedish").split(" ")[0]}`
                            : `🇬🇧 ${tc("language.english")}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">
                          {duration !== null ? tc("time.minutes", { count: duration }) : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/seminars/${seminar.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {tc("actions.monitor")}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("allSeminars")}</CardTitle>
          <CardDescription>{t("allSeminarsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {seminars.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("noSeminars")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>{t("slot")}</TableHead>
                  <TableHead>{t("language")}</TableHead>
                  <TableHead>{tc("status.label")}</TableHead>
                  <TableHead>{tc("time.duration")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seminars.map((seminar) => {
                  const duration = getDurationMinutes(seminar);
                  return (
                    <TableRow key={seminar.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{seminar.student_name}</p>
                          <p className="text-sm text-muted-foreground">{seminar.student_username}</p>
                        </div>
                      </TableCell>
                      <TableCell>{seminar.assignment_name}</TableCell>
                      <TableCell>{formatSlotTime(seminar.window_start, seminar.window_end)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {seminar.language === "sv" ? "🇸🇪" : "🇬🇧"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[seminar.status] || "secondary"}>
                          {seminar.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {duration !== null ? tc("time.minutes", { count: duration }) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {seminar.status === "completed" && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/admin/seminars/${seminar.id}/transcript`}>
                                <FileText className="mr-2 h-4 w-4" />
                                {tc("actions.transcript")}
                              </Link>
                            </Button>
                          )}
                          {seminar.status === "in_progress" && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/admin/seminars/${seminar.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                {tc("actions.monitor")}
                              </Link>
                            </Button>
                          )}
                          {canMarkNoShow(seminar) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleMarkNoShow(seminar.id)}
                              disabled={markingNoShow === seminar.id}
                            >
                              {markingNoShow === seminar.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <UserX className="mr-2 h-4 w-4" />
                              )}
                              {t("markNoShow")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
