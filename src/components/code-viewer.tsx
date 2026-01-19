"use client";

import { useMemo } from "react";
import hljs from "highlight.js/lib/core";
import "highlight.js/styles/github.css";

// Import languages
import java from "highlight.js/lib/languages/java";
import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import scala from "highlight.js/lib/languages/scala";
import r from "highlight.js/lib/languages/r";
import matlab from "highlight.js/lib/languages/matlab";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";

// Register languages
hljs.registerLanguage("java", java);
hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("scala", scala);
hljs.registerLanguage("r", r);
hljs.registerLanguage("matlab", matlab);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("bash", bash);

const LANGUAGE_MAP: Record<string, string> = {
  ".java": "java",
  ".py": "python",
  ".js": "javascript",
  ".ts": "typescript",
  ".jsx": "javascript",
  ".tsx": "typescript",
  ".c": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".r": "r",
  ".m": "matlab",
  ".sql": "sql",
  ".sh": "bash",
  ".bash": "bash",
};

function getLanguageFromFilename(filename: string | null): string | undefined {
  if (!filename) return undefined;
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return LANGUAGE_MAP[ext];
}

interface CodeViewerProps {
  code: string;
  filename?: string | null;
  language?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  className?: string;
}

export function CodeViewer({
  code,
  filename,
  language,
  showLineNumbers = true,
  highlightLines = [],
  className = "",
}: CodeViewerProps) {
  const detectedLanguage = language || getLanguageFromFilename(filename ?? null);

  const highlightedCode = useMemo(() => {
    if (detectedLanguage && hljs.getLanguage(detectedLanguage)) {
      try {
        return hljs.highlight(code, { language: detectedLanguage }).value;
      } catch {
        return hljs.highlightAuto(code).value;
      }
    }
    return hljs.highlightAuto(code).value;
  }, [code, detectedLanguage]);

  const lines = useMemo(() => highlightedCode.split("\n"), [highlightedCode]);
  const highlightSet = useMemo(() => new Set(highlightLines), [highlightLines]);
  const lineNumberWidth = String(lines.length).length;

  if (showLineNumbers) {
    return (
      <div className={`code-viewer rounded-lg overflow-hidden ${className}`}>
        <div className="overflow-x-auto">
          <pre className="hljs !bg-transparent m-0 p-0 text-sm">
            <code className="!bg-transparent block">
              {lines.map((lineHtml, index) => {
                const lineNumber = index + 1;
                const isHighlighted = highlightSet.has(lineNumber);
                return (
                  <div
                    key={index}
                    className={`flex ${isHighlighted ? "bg-yellow-500/20" : ""}`}
                  >
                    <span
                      className="select-none text-right text-muted-foreground/60 text-xs border-r border-border/50 bg-muted/50 shrink-0 px-3 py-0"
                      style={{ minWidth: `${lineNumberWidth + 2}ch` }}
                    >
                      {lineNumber}
                    </span>
                    <span
                      className="px-3 flex-1 whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={{ __html: lineHtml || " " }}
                    />
                  </div>
                );
              })}
            </code>
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className={`code-viewer rounded-lg overflow-hidden ${className}`}>
      <pre className="hljs !bg-transparent p-4 overflow-x-auto m-0 text-sm">
        <code
          className="!bg-transparent"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
}
