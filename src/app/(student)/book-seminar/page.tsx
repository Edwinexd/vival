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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Clock, Globe, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface Assignment {
  id: string;
  name: string;
  course_code: string;
  course_name: string;
  submission_id: string | null;
  submission_status: string | null;
  has_booked_seminar: boolean;
  due_date: string | null;
}

interface Slot {
  id: string;
  window_start: string;
  window_end: string;
  max_concurrent: number;
  booked_count: number;
  spots_available: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
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

function formatTimeWindow(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export default function BookSeminarPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  const t = useTranslations("student.booking");
  const tc = useTranslations("common");

  useEffect(() => {
    fetchAssignments();
  }, []);

  async function fetchAssignments() {
    try {
      const res = await fetch("/api/student/assignments");
      if (!res.ok) throw new Error("Failed to fetch assignments");
      const data = await res.json();
      setAssignments(data.assignments);
    } catch {
      toast.error(tc("errors.loadFailed"));
    } finally {
      setLoadingAssignments(false);
    }
  }

  async function fetchSlots(assignmentId: string) {
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot("");
    try {
      const res = await fetch(`/api/student/slots?assignmentId=${assignmentId}`);
      if (!res.ok) throw new Error("Failed to fetch slots");
      const data = await res.json();
      setSlots(data.slots);
    } catch {
      toast.error(tc("errors.loadFailed"));
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleAssignmentSelect(assignmentId: string) {
    const assignment = assignments.find((a) => a.id === assignmentId);
    setSelectedAssignment(assignment || null);
    if (assignment) {
      fetchSlots(assignmentId);
    }
  }

  async function handleBooking() {
    if (!selectedAssignment?.submission_id || !selectedSlot) {
      toast.error(t("selectBoth"));
      return;
    }

    setBooking(true);
    try {
      const res = await fetch("/api/student/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selectedAssignment.submission_id,
          slotId: selectedSlot,
          language: selectedLanguage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("bookingFailed"));
      }

      toast.success(t("bookingSuccess"));

      setSelectedAssignment(null);
      setSelectedSlot("");
      setSlots([]);
      await fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bookingFailed"));
    } finally {
      setBooking(false);
    }
  }

  function getStatusBadge(status: string | null) {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; labelKey: string }> = {
      pending: { variant: "secondary", labelKey: "pendingReview" },
      reviewing: { variant: "secondary", labelKey: "underReview" },
      reviewed: { variant: "default", labelKey: "readyToBook" },
      seminar_pending: { variant: "outline", labelKey: "seminarBooked" },
      seminar_completed: { variant: "default", labelKey: "seminarCompleted" },
      approved: { variant: "default", labelKey: "approved" },
      rejected: { variant: "destructive", labelKey: "rejected" },
    };
    const config = status ? statusConfig[status] : { variant: "secondary" as const, labelKey: "unknown" };
    return <Badge variant={config.variant}>{tc(`status.${config.labelKey}`)}</Badge>;
  }

  const bookableAssignments = assignments.filter(
    (a) => a.submission_status === "reviewed" && !a.has_booked_seminar
  );

  const bookedAssignments = assignments.filter(
    (a) => a.has_booked_seminar || a.submission_status === "seminar_pending" || a.submission_status === "seminar_completed"
  );

  const pendingAssignments = assignments.filter(
    (a) => a.submission_status && !["reviewed", "seminar_pending", "seminar_completed", "approved", "rejected"].includes(a.submission_status)
  );

  if (loadingAssignments) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{t("noSubmissionsFound")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("noSubmissionsDescription")}</p>
          </CardContent>
        </Card>
      ) : bookableAssignments.length === 0 && pendingAssignments.length === 0 && bookedAssignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{t("noBookableAssignments")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("noBookableDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t("bookSlotTitle")}
              </CardTitle>
              <CardDescription>{t("bookSlotDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {bookableAssignments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">{t("notReadyForBooking")}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="assignment">{t("assignment")}</Label>
                    <Select
                      value={selectedAssignment?.id || ""}
                      onValueChange={handleAssignmentSelect}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("selectAssignment")} />
                      </SelectTrigger>
                      <SelectContent>
                        {bookableAssignments.map((assignment) => (
                          <SelectItem key={assignment.id} value={assignment.id}>
                            {assignment.course_code}: {assignment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedAssignment && (
                    <div className="space-y-2">
                      <Label htmlFor="slot">{t("timeSlot")}</Label>
                      {loadingSlots ? (
                        <div className="flex items-center gap-2 py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">{t("loadingSlots")}</span>
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-center">
                          <p className="text-sm text-muted-foreground">{t("noSlotsAvailable")}</p>
                        </div>
                      ) : (
                        <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("selectTimeSlot")} />
                          </SelectTrigger>
                          <SelectContent>
                            {slots.map((slot) => (
                              <SelectItem
                                key={slot.id}
                                value={slot.id}
                                disabled={slot.spots_available <= 0}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{formatDate(slot.window_start)}</span>
                                  <span className="text-muted-foreground">
                                    {formatTimeWindow(slot.window_start, slot.window_end)}
                                  </span>
                                  <Badge
                                    variant={slot.spots_available > 2 ? "secondary" : "outline"}
                                    className="ml-2"
                                  >
                                    {tc("time.spots", { count: slot.spots_available })}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {selectedSlot && (
                    <div className="space-y-2">
                      <Label htmlFor="language" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {tc("language.label")}
                      </Label>
                      <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">{tc("language.english")}</SelectItem>
                          <SelectItem value="sv">{tc("language.swedish")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{t("examLanguageNote")}</p>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    disabled={!selectedSlot || booking}
                    onClick={handleBooking}
                  >
                    {booking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tc("actions.booking")}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {tc("actions.bookSeminar")}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {bookedAssignments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("bookedSeminars")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {bookedAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">
                            {assignment.course_code}: {assignment.name}
                          </p>
                        </div>
                        {getStatusBadge(assignment.submission_status)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {pendingAssignments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("awaitingReview")}</CardTitle>
                  <CardDescription>{t("awaitingReviewDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">
                            {assignment.course_code}: {assignment.name}
                          </p>
                        </div>
                        {getStatusBadge(assignment.submission_status)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("bookingInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong>{tc("time.duration")}:</strong> {t("infoTimeWindows")}
                </p>
                <p>
                  <strong>{tc("language.label")}:</strong> {t("infoLanguage")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
