"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { CodeViewer } from "@/components/code-viewer";

interface CodeIssue {
  type: string;
  line: number | null;
  description: string;
  severity: "critical" | "major" | "minor";
}

interface ReviewData {
  id: string;
  feedback: string | null;
  issues: CodeIssue[] | null;
  model: string;
  createdAt: string;
  submission: {
    id: string;
    filename: string | null;
    file_content: string | null;
    status: string;
    compile_success: boolean | null;
    compile_errors: Array<{ file: string; line: number; message: string; type: string }> | null;
  };
}

interface SubmissionInfo {
  id: string;
  student_username: string;
  student_name: string | null;
  assignment_name: string;
  course_code: string;
  filename: string | null;
  status: string;
  uploaded_at: string;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    reviewing: "secondary",
    reviewed: "outline",
    seminar_pending: "outline",
    seminar_completed: "default",
    approved: "default",
    rejected: "destructive",
  };
  return variants[status] || "secondary";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchSubmission(submissionId: string): Promise<SubmissionInfo | null> {
  const res = await fetch(`/api/admin/submissions?id=${submissionId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.submissions?.[0] || null;
}

async function fetchReview(submissionId: string): Promise<ReviewData | null> {
  const res = await fetch(`/api/admin/reviews/${submissionId}`);
  if (!res.ok) return null;
  return res.json();
}

async function triggerReviewApi(submissionId: string): Promise<void> {
  const res = await fetch("/api/admin/reviews/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to trigger review");
  }
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const submissionId = params.id as string;
  const queryClient = useQueryClient();

  const { data: submission, isLoading: loadingSubmission } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => fetchSubmission(submissionId),
    enabled: !!submissionId,
  });

  const { data: reviewData, isLoading: loadingReview } = useQuery({
    queryKey: ["review", submissionId],
    queryFn: () => fetchReview(submissionId),
    enabled: !!submissionId,
  });

  const triggerReviewMutation = useMutation({
    mutationFn: () => triggerReviewApi(submissionId),
    onSuccess: () => {
      toast.success("Review triggered successfully");
      queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["review", submissionId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to trigger review");
    },
  });

  const loading = loadingSubmission || loadingReview;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!submission && !reviewData) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/admin/submissions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Submissions
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Submission not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const displaySubmission = submission || {
    id: submissionId,
    student_username: "Unknown",
    student_name: null,
    assignment_name: "Unknown",
    course_code: "",
    filename: reviewData?.submission?.filename || null,
    status: reviewData?.submission?.status || "unknown",
    uploaded_at: "",
  };

  // Get line numbers with compilation errors for highlighting
  const errorLines = reviewData?.submission.compile_errors?.map(e => e.line) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/admin/submissions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Submissions
          </Link>
        </Button>
        {displaySubmission.status === "pending" && (
          <Button onClick={() => triggerReviewMutation.mutate()} disabled={triggerReviewMutation.isPending}>
            {triggerReviewMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run Review
          </Button>
        )}
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {displaySubmission.student_username}
        </h1>
        <p className="text-muted-foreground">
          {displaySubmission.assignment_name}
          {displaySubmission.course_code && ` (${displaySubmission.course_code})`}
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={getStatusBadgeVariant(displaySubmission.status)}>
              {displaySubmission.status.replace("_", " ")}
            </Badge>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="pb-2">
            <CardDescription>File</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm truncate">
              {displaySubmission.filename || "No filename"}
            </div>
          </CardContent>
        </Card>
        {displaySubmission.uploaded_at && (
          <Card className="flex-1 min-w-[200px]">
            <CardHeader className="pb-2">
              <CardDescription>Uploaded</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm">{formatDate(displaySubmission.uploaded_at)}</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="code" className="w-full">
        <TabsList>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="issues">
            Issues ({reviewData?.issues?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="code" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{displaySubmission.filename || "Source Code"}</CardTitle>
              {reviewData?.submission.compile_success === false && (
                <CardDescription className="text-destructive">
                  Compilation failed
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {reviewData?.submission.compile_success === false &&
                reviewData.submission.compile_errors &&
                reviewData.submission.compile_errors.length > 0 && (
                  <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm font-medium text-destructive mb-2">
                      Compilation Errors
                    </p>
                    {reviewData.submission.compile_errors.map((err, i) => (
                      <div key={i} className="text-sm font-mono text-destructive/80">
                        {err.file}:{err.line} - {err.message}
                      </div>
                    ))}
                  </div>
                )}
              {reviewData?.submission.file_content ? (
                <CodeViewer
                  code={reviewData.submission.file_content}
                  filename={displaySubmission.filename}
                  highlightLines={errorLines}
                />
              ) : (
                <div className="p-4 bg-muted rounded-lg text-muted-foreground text-center">
                  No code content available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Review</CardTitle>
              {reviewData && (
                <CardDescription>
                  Model: {reviewData.model} | Reviewed: {formatDate(reviewData.createdAt)}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {reviewData ? (
                <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap leading-relaxed">
                  {reviewData.feedback || "No feedback available"}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  No review available. Click &quot;Run Review&quot; to analyze this submission.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Issues Found</CardTitle>
              <CardDescription>
                {reviewData?.issues?.length || 0} issues identified
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviewData?.issues && reviewData.issues.length > 0 ? (
                <div className="space-y-4">
                  {reviewData.issues.map((issue, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border ${
                        issue.severity === "critical"
                          ? "bg-destructive/10 border-destructive/20"
                          : issue.severity === "major"
                          ? "bg-orange-500/10 border-orange-500/20"
                          : "bg-muted border-muted-foreground/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={issue.severity === "critical" ? "destructive" : "secondary"}
                        >
                          {issue.severity}
                        </Badge>
                        <span className="font-medium">{issue.type}</span>
                        {issue.line && (
                          <span className="text-sm text-muted-foreground">
                            Line {issue.line}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{issue.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {reviewData ? "No issues found" : "No review available"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
