"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, GraduationCap, Loader2, Search } from "lucide-react";

interface SubmissionForGrading {
  id: string;
  student_id: string;
  assignment_id: string;
  filename: string | null;
  status: string;
  uploaded_at: string;
  student_username: string;
  student_name: string | null;
  assignment_name: string;
  review_score: number | null;
  review_feedback: string | null;
  seminar_status: string | null;
  seminar_duration: number | null;
  grade_id: string | null;
  grade_review_score: number | null;
  grade_seminar_score: number | null;
  final_grade: string | null;
  admin_notes: string | null;
  student_feedback: string | null;
}

interface GradeFormData {
  review_score: string;
  seminar_score: string;
  final_grade: string;
  admin_notes: string;
  student_feedback: string;
}

const GRADE_OPTIONS = ["A", "B", "C", "D", "E", "F", "Fx"];

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    reviewed: "secondary",
    seminar_pending: "outline",
    seminar_completed: "default",
    approved: "default",
    rejected: "destructive",
  };
  return variants[status] || "secondary";
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchGradingSubmissions(): Promise<SubmissionForGrading[]> {
  const res = await fetch("/api/admin/grading");
  if (!res.ok) throw new Error("Failed to fetch submissions");
  const data = await res.json();
  return data.submissions;
}

export default function GradingPage() {
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionForGrading | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<GradeFormData>({
    review_score: "",
    seminar_score: "",
    final_grade: "",
    admin_notes: "",
    student_feedback: "",
  });
  const queryClient = useQueryClient();

  const t = useTranslations("admin.grading");
  const tc = useTranslations("common");

  const { data: submissions = [], isLoading: loading } = useQuery({
    queryKey: ["admin-grading-submissions"],
    queryFn: fetchGradingSubmissions,
  });

  const openGradingDialog = (submission: SubmissionForGrading) => {
    setSelectedSubmission(submission);
    setFormData({
      review_score: submission.grade_review_score?.toString() ?? submission.review_score?.toString() ?? "",
      seminar_score: submission.grade_seminar_score?.toString() ?? "",
      final_grade: submission.final_grade ?? "",
      admin_notes: submission.admin_notes ?? "",
      student_feedback: submission.student_feedback ?? "",
    });
    setDialogOpen(true);
  };

  const saveGradeMutation = useMutation({
    mutationFn: async (params: { updateStatus: boolean }) => {
      if (!selectedSubmission) throw new Error("No submission selected");
      const res = await fetch("/api/admin/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: selectedSubmission.id,
          review_score: formData.review_score ? parseInt(formData.review_score) : null,
          seminar_score: formData.seminar_score ? parseInt(formData.seminar_score) : null,
          final_grade: formData.final_grade || null,
          admin_notes: formData.admin_notes || null,
          student_feedback: formData.student_feedback || null,
          update_status: params.updateStatus,
        }),
      });
      if (!res.ok) throw new Error("Failed to save grade");
    },
    onSuccess: () => {
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-grading-submissions"] });
    },
  });

  const handleSaveGrade = (updateStatus: boolean = false) => {
    saveGradeMutation.mutate({ updateStatus });
  };

  const handleExportCSV = () => {
    const graded = submissions.filter((s) => s.final_grade);
    if (graded.length === 0) return;

    const headers = ["Student Username", "Student Name", "Assignment", "Review Score", "Seminar Score", "Final Grade", "Status"];
    const rows = graded.map((s) => [
      s.student_username,
      s.student_name || "",
      s.assignment_name,
      s.grade_review_score?.toString() || "",
      s.grade_seminar_score?.toString() || "",
      s.final_grade || "",
      s.status,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `grades-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.student_username.toLowerCase().includes(query) ||
      (s.student_name?.toLowerCase().includes(query) ?? false) ||
      s.assignment_name.toLowerCase().includes(query)
    );
  });

  const pendingGrading = filteredSubmissions.filter((s) => !s.final_grade && s.status === "seminar_completed");
  const gradedSubmissions = filteredSubmissions.filter((s) => s.final_grade);
  const awaitingSeminar = filteredSubmissions.filter((s) => !s.final_grade && s.status !== "seminar_completed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={handleExportCSV} disabled={gradedSubmissions.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          {tc("actions.exportGrades")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("readyToGrade")}</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingGrading.length}</div>
            <p className="text-xs text-muted-foreground">{t("seminarCompleted")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("awaitingSeminar")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{awaitingSeminar.length}</div>
            <p className="text-xs text-muted-foreground">{t("notYetExamined")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("graded")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gradedSubmissions.length}</div>
            <p className="text-xs text-muted-foreground">{t("completedGrading")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("submissions")}</CardTitle>
          <CardDescription>{t("submissionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">{t("tabs.pending")} ({pendingGrading.length})</TabsTrigger>
              <TabsTrigger value="awaiting">{t("tabs.awaiting")} ({awaitingSeminar.length})</TabsTrigger>
              <TabsTrigger value="graded">{t("tabs.graded")} ({gradedSubmissions.length})</TabsTrigger>
              <TabsTrigger value="all">{t("tabs.all")} ({filteredSubmissions.length})</TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="pending">
                  <SubmissionsTable submissions={pendingGrading} onGrade={openGradingDialog} t={t} tc={tc} />
                </TabsContent>
                <TabsContent value="awaiting">
                  <SubmissionsTable submissions={awaitingSeminar} onGrade={openGradingDialog} t={t} tc={tc} />
                </TabsContent>
                <TabsContent value="graded">
                  <SubmissionsTable submissions={gradedSubmissions} onGrade={openGradingDialog} t={t} tc={tc} />
                </TabsContent>
                <TabsContent value="all">
                  <SubmissionsTable submissions={filteredSubmissions} onGrade={openGradingDialog} t={t} tc={tc} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("gradeSubmission")}</DialogTitle>
            <DialogDescription>
              {selectedSubmission && (
                <>
                  {selectedSubmission.student_name || selectedSubmission.student_username} - {selectedSubmission.assignment_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6">
              <div className="grid gap-4 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("status")}:</span>{" "}
                    <Badge variant={getStatusBadgeVariant(selectedSubmission.status)}>
                      {selectedSubmission.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("uploaded")}:</span>{" "}
                    {formatDate(selectedSubmission.uploaded_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("aiReviewScore")}:</span>{" "}
                    {selectedSubmission.review_score ?? "-"}/100
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("seminarDuration")}:</span>{" "}
                    {formatDuration(selectedSubmission.seminar_duration)}
                  </div>
                </div>
                {selectedSubmission.review_feedback && (
                  <div>
                    <span className="text-sm text-muted-foreground">{t("aiFeedback")}:</span>
                    <p className="mt-1 text-sm whitespace-pre-wrap rounded bg-muted p-2">
                      {selectedSubmission.review_feedback}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="review_score">{t("codeReviewScore")}</Label>
                  <Input
                    id="review_score"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0-100"
                    value={formData.review_score}
                    onChange={(e) => setFormData({ ...formData, review_score: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seminar_score">{t("seminarScore")}</Label>
                  <Input
                    id="seminar_score"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0-100"
                    value={formData.seminar_score}
                    onChange={(e) => setFormData({ ...formData, seminar_score: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="final_grade">{t("finalGrade")}</Label>
                  <Select
                    value={formData.final_grade}
                    onValueChange={(value) => setFormData({ ...formData, final_grade: value })}
                  >
                    <SelectTrigger id="final_grade">
                      <SelectValue placeholder={t("selectGrade")} />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADE_OPTIONS.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin_notes">{t("adminNotes")}</Label>
                <Textarea
                  id="admin_notes"
                  placeholder={t("adminNotesPlaceholder")}
                  value={formData.admin_notes}
                  onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="student_feedback">{t("studentFeedback")}</Label>
                <Textarea
                  id="student_feedback"
                  placeholder={t("studentFeedbackPlaceholder")}
                  value={formData.student_feedback}
                  onChange={(e) => setFormData({ ...formData, student_feedback: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tc("actions.cancel")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSaveGrade(false)}
              disabled={saveGradeMutation.isPending}
            >
              {saveGradeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc("actions.saveDraft")}
            </Button>
            <Button
              onClick={() => handleSaveGrade(true)}
              disabled={saveGradeMutation.isPending || !formData.final_grade}
            >
              {saveGradeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc("actions.saveAndFinalize")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubmissionsTable({
  submissions,
  onGrade,
  t,
  tc,
}: {
  submissions: SubmissionForGrading[];
  onGrade: (submission: SubmissionForGrading) => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <GraduationCap className="h-12 w-12 mb-4" />
        <p>{t("noSubmissionsFound")}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Assignment</TableHead>
          <TableHead>{tc("status.pending")}</TableHead>
          <TableHead className="text-center">{t("review")}</TableHead>
          <TableHead className="text-center">Seminar</TableHead>
          <TableHead className="text-center">{t("finalGrade")}</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((submission) => (
          <TableRow key={submission.id}>
            <TableCell>
              <div>
                <div className="font-medium">{submission.student_username}</div>
                {submission.student_name && (
                  <div className="text-sm text-muted-foreground">{submission.student_name}</div>
                )}
              </div>
            </TableCell>
            <TableCell>{submission.assignment_name}</TableCell>
            <TableCell>
              <Badge variant={getStatusBadgeVariant(submission.status)}>
                {submission.status.replace("_", " ")}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {submission.grade_review_score ?? submission.review_score ?? "-"}
            </TableCell>
            <TableCell className="text-center">
              {submission.grade_seminar_score ?? "-"}
            </TableCell>
            <TableCell className="text-center">
              {submission.final_grade ? (
                <Badge variant={submission.final_grade === "F" ? "destructive" : "default"}>
                  {submission.final_grade}
                </Badge>
              ) : (
                "-"
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(submission.uploaded_at)}
            </TableCell>
            <TableCell>
              <Button size="sm" variant="outline" onClick={() => onGrade(submission)}>
                {tc("actions.grade")}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
