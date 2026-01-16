import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createHash } from 'crypto';
import { getSession } from '@/lib/auth';
import { generateIds } from '@/lib/id';
import {
  createSubmission,
  createUser,
  getUserByUsername,
  getAssignmentById,
} from '@/lib/db/queries';

interface ParsedSubmission {
  username: string;
  filename: string;
  content: string;
  hash: string;
}

type UploadFormat = 'moodle' | 'vpl' | 'unknown';

// Detect upload format from folder structure
function detectFormat(folderNames: string[]): UploadFormat {
  // VPL format: "FirstName LastName ID username@su_se" or "...@su.se"
  const vplPattern = /@su[._]se$/i;
  // Moodle format: "FirstName LastName_ID_assignsubmission_file_"
  const moodlePattern = /_\d+_assignsubmission_file_$/;

  let vplCount = 0;
  let moodleCount = 0;

  for (const name of folderNames) {
    if (vplPattern.test(name)) vplCount++;
    if (moodlePattern.test(name)) moodleCount++;
  }

  if (vplCount > moodleCount && vplCount > 0) return 'vpl';
  if (moodleCount > 0) return 'moodle';
  return 'unknown';
}

// Parse VPL format: "FirstName LastName ID username@su_se" or "...@su.se"
function parseVplUsername(folderName: string): string | null {
  // Match pattern: anything followed by username@su_se or @su.se
  const match = folderName.match(/\s+([a-z]{4}\d{4})@su[._]se$/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return null;
}

// Parse Moodle format: "FirstName LastName_ID_assignsubmission_file_"
function parseMoodleUsername(folderName: string): string | null {
  const match = folderName.match(/^(.+?)_(\d+)_/);
  if (match) {
    // Convert "FirstName LastName" to a username (lowercase, no spaces)
    const name = match[1].toLowerCase().replace(/\s+/g, '');
    return name;
  }
  return null;
}

// Parse student username from folder path based on format
function parseStudentUsername(path: string, format: UploadFormat): string | null {
  const parts = path.split('/');
  if (parts.length < 2) return null;

  const folderName = parts[0];

  if (format === 'vpl') {
    return parseVplUsername(folderName);
  }

  if (format === 'moodle') {
    return parseMoodleUsername(folderName);
  }

  // Try both formats
  return parseVplUsername(folderName) || parseMoodleUsername(folderName) ||
    (/^[a-z0-9]+$/i.test(folderName) ? folderName.toLowerCase() : null);
}

// Common source code file extensions
const SOURCE_EXTENSIONS = new Set([
  '.java', '.py', '.js', '.ts', '.jsx', '.tsx',
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
  '.cs', '.go', '.rs', '.rb', '.php',
  '.swift', '.kt', '.kts', '.scala',
  '.r', '.R', '.m', '.mm',
  '.sql', '.sh', '.bash', '.ps1',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.xml', '.yaml', '.yml',
]);

function isSourceFile(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.'));
  return SOURCE_EXTENSIONS.has(ext.toLowerCase());
}

// Check if path is a valid source file path for VPL format
// VPL has: StudentFolder/YYYY-MM-DD-HH-MM-SS/file.py (we want this)
// VPL also has: StudentFolder/YYYY-MM-DD-HH-MM-SS.ceg/... (ignore these)
function isValidVplSourcePath(path: string): boolean {
  const parts = path.split('/');
  // Need at least: student folder / timestamp folder / file
  if (parts.length < 3) return false;

  // Ignore .ceg folders (VPL metadata)
  if (parts[1].endsWith('.ceg')) return false;

  // Timestamp folder should match YYYY-MM-DD-HH-MM-SS pattern
  const timestampPattern = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;
  return timestampPattern.test(parts[1]);
}

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

interface ParseZipResult {
  submissions: ParsedSubmission[];
  format: UploadFormat;
}

async function parseZip(buffer: ArrayBuffer): Promise<ParseZipResult> {
  const zip = await JSZip.loadAsync(buffer);
  const submissions: ParsedSubmission[] = [];
  const filePromises: Promise<void>[] = [];

  // Collect top-level folder names for format detection
  const topLevelFolders = new Set<string>();
  zip.forEach((relativePath) => {
    const firstFolder = relativePath.split('/')[0];
    if (firstFolder) topLevelFolders.add(firstFolder);
  });

  const format = detectFormat(Array.from(topLevelFolders));

  zip.forEach((relativePath, zipEntry) => {
    // Only process source code files
    const filename = relativePath.split('/').pop() || 'unknown';
    if (!isSourceFile(filename) || zipEntry.dir) return;

    // For VPL format, validate the path structure
    if (format === 'vpl' && !isValidVplSourcePath(relativePath)) return;

    const username = parseStudentUsername(relativePath, format);
    if (!username) return;

    const promise = zipEntry.async('string').then((content) => {
      submissions.push({
        username,
        filename,
        content,
        hash: computeHash(content),
      });
    });
    filePromises.push(promise);
  });

  await Promise.all(filePromises);
  return { submissions, format };
}

export async function POST(request: NextRequest) {
  // Verify admin session
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const assignmentId = formData.get('assignmentId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
    }

    // Verify assignment exists
    const assignment = await getAssignmentById(assignmentId);
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Get or create admin user for uploaded_by field
    let adminUser = await getUserByUsername(session.username);
    if (!adminUser) {
      const [adminId] = await generateIds(1);
      adminUser = await createUser(adminId, session.username, undefined, undefined, true);
    }

    // Verify file is a ZIP
    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'File must be a ZIP archive' }, { status: 400 });
    }

    // Parse ZIP file
    const buffer = await file.arrayBuffer();
    const { submissions: parsedSubmissions, format } = await parseZip(buffer);

    if (parsedSubmissions.length === 0) {
      return NextResponse.json(
        { error: 'No source files found in ZIP. Supported formats: Moodle ZIP, VPL export.' },
        { status: 400 }
      );
    }

    // Group submissions by username (combine multiple files into one submission)
    const byUsername = new Map<string, ParsedSubmission[]>();
    for (const sub of parsedSubmissions) {
      const existing = byUsername.get(sub.username) || [];
      existing.push(sub);
      byUsername.set(sub.username, existing);
    }

    // Generate IDs for all submissions and potentially new users
    const usernames = Array.from(byUsername.keys());
    const maxIds = usernames.length * 2; // Worst case: new user + submission for each
    const ids = await generateIds(maxIds);
    let idIndex = 0;

    const results: Array<{
      username: string;
      submissionId: string;
      files: string[];
    }> = [];

    const errors: Array<{
      username: string;
      error: string;
    }> = [];

    // Process each student's submission
    for (const [username, files] of byUsername) {
      try {
        // Get or create user
        let user = await getUserByUsername(username);
        if (!user) {
          const userId = ids[idIndex++];
          user = await createUser(userId, username);
        }

        // Combine all Java files into one submission
        // Format: filename + content for each file
        const combinedContent = files
          .map((f) => `// ===== ${f.filename} =====\n${f.content}`)
          .join('\n\n');

        const combinedHash = computeHash(combinedContent);
        const primaryFilename = files.length === 1
          ? files[0].filename
          : `${files.length} files`;

        // Create submission
        const submissionId = ids[idIndex++];
        await createSubmission(
          submissionId,
          user.id,
          assignmentId,
          combinedContent,
          adminUser.id,
          primaryFilename,
          combinedHash
        );

        results.push({
          username,
          submissionId,
          files: files.map((f) => f.filename),
        });
      } catch (err) {
        errors.push({
          username,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      format,
      uploaded: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
