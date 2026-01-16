"use client";

import { useEffect, useState, useCallback } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Play, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Submission {
  id: string;
  student_username: string;
  student_name: string | null;
  assignment_name: string;
  course_code: string;
  status: string;
  uploaded_at: string;
}

export default function ReviewsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/submissions");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions);
      }
    } catch {
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const pendingSubmissions = submissions.filter((s) => s.status === "pending");
  const reviewedSubmissions = submissions.filter((s) => s.status === "reviewed" || s.status === "reviewing");

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const selectAllPending = () => {
    if (selected.size === pendingSubmissions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingSubmissions.map((s) => s.id)));
    }
  };

  const triggerBatchReview = async () => {
    if (selected.size === 0) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/reviews/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionIds: Array.from(selected) }),
      });
      if (res.ok) {
        toast.success(`Triggered review for ${selected.size} submissions`);
        setSelected(new Set());
        fetchSubmissions();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to trigger reviews");
      }
    } catch {
      toast.error("Failed to trigger reviews");
    } finally {
      setProcessing(false);
    }
  };

  const triggerSingleReview = async (id: string) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/reviews/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: id }),
      });
      if (res.ok) {
        toast.success("Review triggered");
        fetchSubmissions();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to trigger review");
      }
    } catch {
      toast.error("Failed to trigger review");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Reviews</h1>
        <p className="text-muted-foreground">Trigger and manage GPT code reviews</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl">{pendingSubmissions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reviewed</CardDescription>
            <CardTitle className="text-3xl">{reviewedSubmissions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Selected</CardDescription>
            <CardTitle className="text-3xl">{selected.size}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pending Reviews</CardTitle>
            <CardDescription>Select submissions to trigger AI review</CardDescription>
          </div>
          <Button
            onClick={triggerBatchReview}
            disabled={selected.size === 0 || processing}
          >
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Review Selected ({selected.size})
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p>No pending reviews</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selected.size === pendingSubmissions.length && pendingSubmissions.length > 0}
                      onCheckedChange={selectAllPending}
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingSubmissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={() => toggleSelect(s.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{s.student_username}</div>
                      {s.student_name && <div className="text-sm text-muted-foreground">{s.student_name}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{s.assignment_name}</div>
                      <div className="text-sm text-muted-foreground">{s.course_code}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(s.uploaded_at).toLocaleDateString("sv-SE")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => triggerSingleReview(s.id)}
                        disabled={processing}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently Reviewed</CardTitle>
          <CardDescription>Submissions that have been reviewed by GPT</CardDescription>
        </CardHeader>
        <CardContent>
          {reviewedSubmissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No reviewed submissions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewedSubmissions.slice(0, 10).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.student_username}</TableCell>
                    <TableCell>{s.assignment_name}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "reviewed" ? "default" : "secondary"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
