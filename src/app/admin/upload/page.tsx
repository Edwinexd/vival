"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Upload, FileArchive, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Assignment {
  id: string;
  name: string;
  course_id: string;
}

interface UploadResult {
  username: string;
  submissionId: string;
  files: string[];
}

interface UploadError {
  username: string;
  error: string;
}

interface UploadResponse {
  success: boolean;
  uploaded: number;
  failed: number;
  results: UploadResult[];
  errors?: UploadError[];
}

export default function UploadPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = useTranslations("admin.upload");
  const tc = useTranslations("common");

  useEffect(() => {
    fetch("/api/admin/assignments")
      .then((res) => res.json())
      .then((data) => {
        if (data.assignments) {
          setAssignments(data.assignments);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingAssignments(false));
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      if (files[0].name.endsWith(".zip")) {
        setSelectedFile(files[0]);
        setError(null);
        setUploadResult(null);
      } else {
        setError(t("selectZipFile"));
      }
    }
  }, [t]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      if (files[0].name.endsWith(".zip")) {
        setSelectedFile(files[0]);
        setError(null);
        setUploadResult(null);
      } else {
        setError(t("selectZipFile"));
      }
    }
  }, [t]);

  const handleUpload = async () => {
    if (!selectedFile || !selectedAssignment) {
      setError(t("selectFileAndAssignment"));
      return;
    }

    setLoading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("assignmentId", selectedAssignment);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || tc("errors.saveFailed"));
        return;
      }

      setUploadResult(data);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setError(tc("errors.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("settingsTitle")}</CardTitle>
            <CardDescription>{t("settingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignment">{t("assignment")}</Label>
              <Select
                value={selectedAssignment}
                onValueChange={setSelectedAssignment}
                disabled={loadingAssignments || loading}
              >
                <SelectTrigger id="assignment" className="w-full">
                  <SelectValue placeholder={t("selectAssignment")} />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={loading}
              />
              <div className="flex flex-col items-center gap-2">
                {selectedFile ? (
                  <>
                    <FileArchive className="h-10 w-10 text-primary" />
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">{t("dropZipHere")}</p>
                    <p className="text-sm text-muted-foreground">{t("orClickToBrowse")}</p>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedAssignment || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tc("actions.uploading")}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {tc("actions.upload")}
                  </>
                )}
              </Button>
              {selectedFile && (
                <Button variant="outline" onClick={resetUpload} disabled={loading}>
                  {tc("actions.clear")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("moodleZipFormat")}</CardTitle>
            <CardDescription>{t("expectedStructure")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <p>{t("moodleInstructions")}</p>
              <pre className="rounded-md bg-muted p-3 text-xs">
{`submissions.zip
├── FirstName LastName_12345_assignsubmission_file_/
│   └── Solution.java
├── Another Student_67890_assignsubmission_file_/
│   ├── Main.java
│   └── Helper.java
└── ...`}
              </pre>
              <p className="text-muted-foreground">{t("onlyJavaFiles")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {t("uploadComplete")}
            </CardTitle>
            <CardDescription>
              {t("submissionsUploaded", { count: uploadResult.uploaded })}
              {uploadResult.failed > 0 && `, ${t("failed", { count: uploadResult.failed })}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("student")}</TableHead>
                  <TableHead>{t("files")}</TableHead>
                  <TableHead>{tc("status.pending")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadResult.results.map((r) => (
                  <TableRow key={r.submissionId}>
                    <TableCell className="font-medium">{r.username}</TableCell>
                    <TableCell>
                      {r.files.map((f) => (
                        <Badge key={f} variant="secondary" className="mr-1">
                          {f}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{t("uploaded")}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {uploadResult.errors?.map((e) => (
                  <TableRow key={e.username}>
                    <TableCell className="font-medium">{e.username}</TableCell>
                    <TableCell className="text-destructive">{e.error}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{tc("status.failed")}</Badge>
                    </TableCell>
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
