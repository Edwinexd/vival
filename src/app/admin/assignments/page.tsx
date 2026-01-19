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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BookOpen, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Course {
  id: string;
  code: string;
  name: string;
  semester: string | null;
}

interface Assignment {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  review_prompt: string | null;
  seminar_prompt: string | null;
  due_date: string | null;
  target_time_minutes: number | null;
  max_time_minutes: number | null;
  created_at: string;
}

const defaultFormData = {
  name: "",
  description: "",
  reviewPrompt: "",
  seminarPrompt: "",
  dueDate: "",
  courseId: "",
  newCourseCode: "",
  newCourseName: "",
  newCourseSemester: "",
  targetTimeMinutes: "30",
  maxTimeMinutes: "35",
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [courseTab, setCourseTab] = useState<"existing" | "new">("existing");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/assignments");
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
        setCourses(data.courses || []);
        if (data.courses?.length > 0) {
          setFormData((prev) => prev.courseId ? prev : { ...prev, courseId: data.courses[0].id });
        }
      }
    } catch {
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createAssignment = async () => {
    if (!formData.name.trim()) {
      toast.error("Assignment name is required");
      return;
    }

    if (courseTab === "existing" && !formData.courseId) {
      toast.error("Please select a course");
      return;
    }

    if (courseTab === "new" && (!formData.newCourseCode.trim() || !formData.newCourseName.trim())) {
      toast.error("Course code and name are required");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: formData.name,
        description: formData.description || undefined,
        reviewPrompt: formData.reviewPrompt || undefined,
        seminarPrompt: formData.seminarPrompt || undefined,
        dueDate: formData.dueDate || undefined,
        targetTimeMinutes: formData.targetTimeMinutes ? parseInt(formData.targetTimeMinutes, 10) : undefined,
        maxTimeMinutes: formData.maxTimeMinutes ? parseInt(formData.maxTimeMinutes, 10) : undefined,
      };

      if (courseTab === "existing") {
        body.courseId = formData.courseId;
      } else {
        body.newCourse = {
          code: formData.newCourseCode,
          name: formData.newCourseName,
          semester: formData.newCourseSemester || undefined,
        };
      }

      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Assignment created");
        setDialogOpen(false);
        setFormData(defaultFormData);
        setCourseTab("existing");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create assignment");
      }
    } catch {
      toast.error("Failed to create assignment");
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      ...defaultFormData,
      name: assignment.name,
      description: assignment.description || "",
      reviewPrompt: assignment.review_prompt || "",
      seminarPrompt: assignment.seminar_prompt || "",
      dueDate: assignment.due_date ? assignment.due_date.split("T")[0] : "",
      courseId: assignment.course_id,
      targetTimeMinutes: assignment.target_time_minutes?.toString() || "30",
      maxTimeMinutes: assignment.max_time_minutes?.toString() || "35",
    });
    setEditDialogOpen(true);
  };

  const updateAssignment = async () => {
    if (!editingAssignment) return;
    if (!formData.name.trim()) {
      toast.error("Assignment name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/assignments/${editingAssignment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          reviewPrompt: formData.reviewPrompt || undefined,
          seminarPrompt: formData.seminarPrompt || undefined,
          dueDate: formData.dueDate || undefined,
          targetTimeMinutes: formData.targetTimeMinutes ? parseInt(formData.targetTimeMinutes, 10) : undefined,
          maxTimeMinutes: formData.maxTimeMinutes ? parseInt(formData.maxTimeMinutes, 10) : undefined,
        }),
      });

      if (res.ok) {
        toast.success("Assignment updated");
        setEditDialogOpen(false);
        setEditingAssignment(null);
        setFormData(defaultFormData);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update assignment");
      }
    } catch {
      toast.error("Failed to update assignment");
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async (id: string) => {
    if (!confirm("Delete this assignment? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/assignments/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Assignment deleted");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete assignment");
      }
    } catch {
      toast.error("Failed to delete assignment");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("sv-SE");
  };

  const getCourse = (courseId: string) => {
    return courses.find((c) => c.id === courseId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">Manage course assignments for code review and oral examination</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Assignment</DialogTitle>
              <DialogDescription>Add a new assignment for students to submit code</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Tabs value={courseTab} onValueChange={(v) => setCourseTab(v as "existing" | "new")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Existing Course</TabsTrigger>
                  <TabsTrigger value="new">New Course</TabsTrigger>
                </TabsList>
                <TabsContent value="existing" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select
                      value={formData.courseId}
                      onValueChange={(v) => setFormData({ ...formData, courseId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code}: {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
                <TabsContent value="new" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Course Code *</Label>
                      <Input
                        placeholder="e.g. DA2001"
                        value={formData.newCourseCode}
                        onChange={(e) => setFormData({ ...formData, newCourseCode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Semester</Label>
                      <Input
                        placeholder="e.g. HT2025"
                        value={formData.newCourseSemester}
                        onChange={(e) => setFormData({ ...formData, newCourseSemester: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Course Name *</Label>
                    <Input
                      placeholder="e.g. Programmering II"
                      value={formData.newCourseName}
                      onChange={(e) => setFormData({ ...formData, newCourseName: e.target.value })}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label>Assignment Name *</Label>
                <Input
                  placeholder="e.g. Lab 1: Calculator"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of the assignment..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Duration (minutes)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="120"
                    placeholder="30"
                    value={formData.targetTimeMinutes}
                    onChange={(e) => setFormData({ ...formData, targetTimeMinutes: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ideal examination duration used by AI.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Max Duration (minutes)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="120"
                    placeholder="35"
                    value={formData.maxTimeMinutes}
                    onChange={(e) => setFormData({ ...formData, maxTimeMinutes: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Timer countdown shown to student.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Review Prompt (for GPT code review)</Label>
                <Textarea
                  placeholder="Custom instructions for the AI code reviewer..."
                  value={formData.reviewPrompt}
                  onChange={(e) => setFormData({ ...formData, reviewPrompt: e.target.value })}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use the default prompt. This guides how GPT evaluates the code.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Seminar Prompt (for ElevenLabs voice agent)</Label>
                <Textarea
                  placeholder="Custom instructions for the oral examination..."
                  value={formData.seminarPrompt}
                  onChange={(e) => setFormData({ ...formData, seminarPrompt: e.target.value })}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use the default prompt. This guides the oral examination conversation.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={createAssignment} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Assignments</CardDescription>
            <CardTitle className="text-3xl">{assignments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Courses</CardDescription>
            <CardTitle className="text-3xl">{courses.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>With Due Date</CardDescription>
            <CardTitle className="text-3xl">{assignments.filter((a) => a.due_date).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Assignments</CardTitle>
          <CardDescription>Manage assignments across all courses</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mb-4" />
              <p>No assignments yet</p>
              <p className="text-sm">Create your first assignment to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Prompts</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => {
                  const course = getCourse(assignment.course_id);
                  return (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="font-medium">{assignment.name}</div>
                        {assignment.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {assignment.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {course ? (
                          <div>
                            <div className="font-medium">{course.code}</div>
                            <div className="text-sm text-muted-foreground">{course.name}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(assignment.due_date)}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {assignment.target_time_minutes ?? 30}/{assignment.max_time_minutes ?? 35} min
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {assignment.review_prompt && (
                            <Badge variant="outline" className="text-xs">Review</Badge>
                          )}
                          {assignment.seminar_prompt && (
                            <Badge variant="outline" className="text-xs">Seminar</Badge>
                          )}
                          {!assignment.review_prompt && !assignment.seminar_prompt && (
                            <span className="text-muted-foreground text-sm">Default</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(assignment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteAssignment(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
            <DialogDescription>Update assignment details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assignment Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Duration (minutes)</Label>
                <Input
                  type="number"
                  min="5"
                  max="120"
                  value={formData.targetTimeMinutes}
                  onChange={(e) => setFormData({ ...formData, targetTimeMinutes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Duration (minutes)</Label>
                <Input
                  type="number"
                  min="5"
                  max="120"
                  value={formData.maxTimeMinutes}
                  onChange={(e) => setFormData({ ...formData, maxTimeMinutes: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Review Prompt (for GPT code review)</Label>
              <Textarea
                value={formData.reviewPrompt}
                onChange={(e) => setFormData({ ...formData, reviewPrompt: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Seminar Prompt (for ElevenLabs voice agent)</Label>
              <Textarea
                value={formData.seminarPrompt}
                onChange={(e) => setFormData({ ...formData, seminarPrompt: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={updateAssignment} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
