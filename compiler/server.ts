import Fastify from "fastify";
import { spawn } from "node:child_process";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

interface CompileFile {
  name: string;
  content: string;
}

interface CompileRequest {
  files: CompileFile[];
  timeout?: number;
}

interface CompileError {
  file: string;
  line: number;
  message: string;
  type: "error" | "warning";
}

interface CompileResponse {
  success: boolean;
  output: string;
  errors: CompileError[];
  duration_ms: number;
}

const DEFAULT_TIMEOUT = 30000;
const MAX_TIMEOUT = 60000;
const WORKSPACE_BASE = "/tmp";

function parseJavacOutput(output: string): CompileError[] {
  const errors: CompileError[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    // Match pattern: filename.java:line: error: message
    // or: filename.java:line: warning: message
    const match = line.match(/^([^:]+\.java):(\d+):\s*(error|warning):\s*(.+)$/);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        type: match[3] as "error" | "warning",
        message: match[4],
      });
    }
  }

  return errors;
}

async function compile(files: CompileFile[], timeout: number): Promise<CompileResponse> {
  const startTime = Date.now();
  const workDir = join(WORKSPACE_BASE, randomUUID());

  try {
    await mkdir(workDir, { recursive: true });

    // Write all files to workspace
    for (const file of files) {
      const filePath = join(workDir, file.name);
      await writeFile(filePath, file.content, "utf-8");
    }

    // Get list of .java files
    const javaFiles = files.filter((f) => f.name.endsWith(".java")).map((f) => f.name);

    if (javaFiles.length === 0) {
      return {
        success: false,
        output: "No .java files provided",
        errors: [],
        duration_ms: Date.now() - startTime,
      };
    }

    // Run javac
    const output = await runJavac(workDir, javaFiles, timeout);

    return {
      success: output.exitCode === 0,
      output: output.stderr || output.stdout || "",
      errors: parseJavacOutput(output.stderr),
      duration_ms: Date.now() - startTime,
    };
  } finally {
    // Clean up workspace
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

interface JavacOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runJavac(workDir: string, files: string[], timeout: number): Promise<JavacOutput> {
  return new Promise((resolve) => {
    const proc = spawn("javac", [...files], {
      cwd: workDir,
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    proc.on("error", (err) => {
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

// Create Fastify server
const fastify = Fastify({
  logger: true,
});

// Health check endpoint
fastify.get("/health", async () => {
  return { status: "ok" };
});

// Compile endpoint
fastify.post<{ Body: CompileRequest }>("/compile", async (request, reply) => {
  const { files, timeout: requestTimeout } = request.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return reply.status(400).send({
      success: false,
      output: "No files provided",
      errors: [],
      duration_ms: 0,
    });
  }

  // Validate files
  for (const file of files) {
    if (!file.name || typeof file.content !== "string") {
      return reply.status(400).send({
        success: false,
        output: "Invalid file format: each file must have name and content",
        errors: [],
        duration_ms: 0,
      });
    }
  }

  const timeout = Math.min(requestTimeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);
  const result = await compile(files, timeout);

  return result;
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
