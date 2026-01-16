"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Database, Key, Bot, Mic } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [testingDb, setTestingDb] = useState(false);
  const [dbStatus, setDbStatus] = useState<"unknown" | "connected" | "error">("unknown");

  const testDbConnection = async () => {
    setTestingDb(true);
    try {
      const res = await fetch("/api/admin/assignments");
      if (res.ok) {
        setDbStatus("connected");
        toast.success("Database connection successful");
      } else {
        setDbStatus("error");
        toast.error("Database connection failed");
      }
    } catch {
      setDbStatus("error");
      toast.error("Database connection failed");
    } finally {
      setTestingDb(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">System configuration and status</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Connection
            </CardTitle>
            <CardDescription>PostgreSQL database status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Connection Status</p>
                <p className="text-sm text-muted-foreground">Test the database connection</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge
                  variant={
                    dbStatus === "connected"
                      ? "default"
                      : dbStatus === "error"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {dbStatus === "connected"
                    ? "Connected"
                    : dbStatus === "error"
                    ? "Error"
                    : "Unknown"}
                </Badge>
                <Button onClick={testDbConnection} disabled={testingDb} size="sm">
                  {testingDb ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              OpenAI Configuration
            </CardTitle>
            <CardDescription>GPT code review settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key Status</Label>
              <div className="flex items-center gap-2">
                <Badge variant={process.env.NEXT_PUBLIC_OPENAI_CONFIGURED ? "default" : "secondary"}>
                  {process.env.NEXT_PUBLIC_OPENAI_CONFIGURED ? "Configured" : "Not Set"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Set via OPENAI_API_KEY environment variable
                </span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="review-prompt">Default Review Prompt</Label>
              <Textarea
                id="review-prompt"
                placeholder="Custom instructions for the AI code reviewer..."
                rows={4}
                disabled
                className="font-mono text-sm"
                defaultValue="Review this Java code for correctness, style, and potential improvements. Identify any bugs, suggest better practices, and provide a score out of 100."
              />
              <p className="text-xs text-muted-foreground">
                This prompt is used when reviewing code. Can be customized per assignment.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              ElevenLabs Configuration
            </CardTitle>
            <CardDescription>Voice agent settings for oral examinations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>API Key Status</Label>
                <Badge variant="secondary">Not Set</Badge>
              </div>
              <div className="space-y-2">
                <Label>Agent ID Status</Label>
                <Badge variant="secondary">Not Set</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure via ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID environment variables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Authentication
            </CardTitle>
            <CardDescription>Admin user configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Admin Usernames</Label>
              <Input
                disabled
                value={process.env.NEXT_PUBLIC_ADMIN_USERNAMES || "Set via ADMIN_USERNAMES env var"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of SU usernames with admin access
              </p>
            </div>
            <div className="space-y-2">
              <Label>JWT Secret</Label>
              <Badge variant="default">Configured</Badge>
              <p className="text-xs text-muted-foreground">
                Set via JWT_SECRET environment variable
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>Application details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Environment</p>
                <p className="text-sm text-muted-foreground">
                  {process.env.NODE_ENV || "development"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Base URL</p>
                <p className="text-sm text-muted-foreground">
                  {typeof window !== "undefined" ? window.location.origin : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Max Concurrent Seminars</p>
                <p className="text-sm text-muted-foreground">8 per slot (default)</p>
              </div>
              <div>
                <p className="text-sm font-medium">Supported Languages</p>
                <p className="text-sm text-muted-foreground">English, Swedish</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
