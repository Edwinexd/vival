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
import { Calendar, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";

interface Slot {
  id: string;
  assignment_id: string;
  assignment_name: string;
  course_code: string;
  window_start: string;
  window_end: string;
  max_concurrent: number;
  booked_count: number;
}

interface Assignment {
  id: string;
  name: string;
  course_code: string;
}

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    assignmentId: "",
    startHour: "8",
    endHour: "17",
    maxConcurrent: "8",
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/slots");
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots);
      }
    } catch {
      toast.error("Failed to load slots");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/assignments");
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments);
      }
    } catch {
      // Silent
    }
  }, []);

  useEffect(() => {
    fetchSlots();
    fetchAssignments();
  }, [fetchSlots, fetchAssignments]);

  const createSlots = async () => {
    const missing = [];
    if (!formData.assignmentId) missing.push("assignment");
    if (!selectedDate) missing.push("date");
    if (missing.length > 0) {
      toast.error(`Missing: ${missing.join(", ")}`);
      return;
    }

    const startHour = parseInt(formData.startHour);
    const endHour = parseInt(formData.endHour);
    if (startHour >= endHour) {
      toast.error("End hour must be after start hour");
      return;
    }

    setCreating(true);
    try {
      const dateStr = format(selectedDate!, "yyyy-MM-dd");
      const slotsToCreate = [];
      for (let hour = startHour; hour < endHour; hour++) {
        const windowStart = new Date(`${dateStr}T${hour.toString().padStart(2, "0")}:00:00`);
        const windowEnd = new Date(`${dateStr}T${(hour + 1).toString().padStart(2, "0")}:00:00`);
        slotsToCreate.push({
          assignmentId: formData.assignmentId,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          maxConcurrent: parseInt(formData.maxConcurrent),
        });
      }

      const res = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: slotsToCreate }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Created ${data.created} slots`);
        setDialogOpen(false);
        setFormData({ assignmentId: "", startHour: "8", endHour: "17", maxConcurrent: "8" });
        setSelectedDate(undefined);
        fetchSlots();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create slots");
      }
    } catch {
      toast.error("Failed to create slots");
    } finally {
      setCreating(false);
    }
  };

  const deleteSlot = async (id: string) => {
    if (!confirm("Delete this slot?")) return;

    try {
      const res = await fetch(`/api/admin/slots?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Slot deleted");
        fetchSlots();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete slot");
      }
    } catch {
      toast.error("Failed to delete slot");
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("sv-SE", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const upcomingSlots = slots.filter((s) => new Date(s.window_end) > new Date());
  const pastSlots = slots.filter((s) => new Date(s.window_end) <= new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Seminar Slots</h1>
          <p className="text-muted-foreground">Manage time slots for oral examinations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Slot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Seminar Slots</DialogTitle>
              <DialogDescription>Generate hourly slots for a day</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Assignment</Label>
                <Select
                  value={formData.assignmentId}
                  onValueChange={(v) => setFormData({ ...formData, assignmentId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.course_code}: {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker
                  date={selectedDate}
                  onSelect={setSelectedDate}
                  placeholder="Select date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Select
                    value={formData.startHour}
                    onValueChange={(v) => setFormData({ ...formData, startHour: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Select
                    value={formData.endHour}
                    onValueChange={(v) => setFormData({ ...formData, endHour: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Max Concurrent per Slot</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.maxConcurrent}
                  onChange={(e) => setFormData({ ...formData, maxConcurrent: e.target.value })}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This will create {Math.max(0, parseInt(formData.endHour) - parseInt(formData.startHour))} hourly slots
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={createSlots} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Slots
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Slots</CardDescription>
            <CardTitle className="text-3xl">{slots.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Upcoming</CardDescription>
            <CardTitle className="text-3xl">{upcomingSlots.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Bookings</CardDescription>
            <CardTitle className="text-3xl">{slots.reduce((sum, s) => sum + s.booked_count, 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Slots</CardTitle>
          <CardDescription>Slots available for booking</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : upcomingSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4" />
              <p>No upcoming slots</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Time Window</TableHead>
                  <TableHead className="text-center">Capacity</TableHead>
                  <TableHead className="text-center">Booked</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingSlots.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell>
                      <div className="font-medium">{slot.assignment_name}</div>
                      <div className="text-sm text-muted-foreground">{slot.course_code}</div>
                    </TableCell>
                    <TableCell>
                      {formatDateTime(slot.window_start)} - {formatDateTime(slot.window_end).split(" ").pop()}
                    </TableCell>
                    <TableCell className="text-center">{slot.max_concurrent}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={slot.booked_count >= slot.max_concurrent ? "destructive" : "outline"}>
                        {slot.booked_count}/{slot.max_concurrent}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteSlot(slot.id)}
                        disabled={slot.booked_count > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pastSlots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Slots</CardTitle>
            <CardDescription>Completed time slots</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Time Window</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastSlots.slice(0, 10).map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell>{slot.assignment_name}</TableCell>
                    <TableCell>{formatDateTime(slot.window_start)}</TableCell>
                    <TableCell className="text-center">{slot.booked_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
