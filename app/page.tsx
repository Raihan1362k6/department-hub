"use client";

import { useEffect, useMemo, useState } from "react";
import ElectricalBackground from "./ElectricalBackground";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  Video,
  X,
} from "lucide-react";
import { configured, supabase } from "@/lib/supabase";

type Role = "student" | "monitor" | "admin";
type MemberStatus = "active" | "disabled";
type ResourceCategory = "Class Link" | "Handwritten Notes" | "Digital Notes" | "E-Book";
type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  status?: MemberStatus;
};
type Material = {
  id: string;
  title: string;
  course_name: string;
  semester: number;
  subject: string;
  category: ResourceCategory;
  kind: "file" | "link";
  url: string;
  file_name?: string;
  created_at: string;
  uploader_id: string;
};
type CourseSyllabus = {
  id: string;
  semester: number;
  subject: string;
  file_name: string;
  url: string;
  uploader_id: string;
  updated_at: string;
};
type PyqCourse = {
  id: string;
  semester: number;
  name: string;
};
type PyqExamType = "Mid-Sem" | "End-Sem";
type PyqFile = {
  id: string;
  course_id: string;
  exam_type: PyqExamType;
  title: string;
  file_name: string;
  url: string;
  created_at: string;
  uploader_id: string;
};
type MemberEntry = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: MemberStatus;
};
type Announcement = {
  id: string;
  title: string;
  body: string;
  important: boolean;
  created_at: string;
};
type Assignment = {
  id: string;
  title: string;
  description: string;
  subject: string;
  due_date: string;
  created_at?: string;
  attachment_url?: string | null;
  file_name?: string | null;
};
type Completion = { assignment_id: string; done: boolean };

const demoMaterials: Material[] = [
  { id: "m1", title: "Unit 2 Notes", course_name: "Data Structures", semester: 3, subject: "Data Structures", category: "Digital Notes", kind: "file", url: "#", created_at: new Date().toISOString(), uploader_id: "demo" },
  { id: "m2", title: "Graph Theory Cheat Sheet", course_name: "Discrete Mathematics", semester: 3, subject: "Mathematics", category: "Handwritten Notes", kind: "file", url: "#", created_at: new Date().toISOString(), uploader_id: "demo" },
  { id: "m3", title: "Operating Systems Playlist", course_name: "Operating Systems", semester: 3, subject: "Operating Systems", category: "Class Link", kind: "link", url: "https://nptel.ac.in/", created_at: new Date().toISOString(), uploader_id: "demo" },
  { id: "m4", title: "DBMS Revision Videos", course_name: "Database Systems", semester: 4, subject: "Database Systems", category: "Class Link", kind: "link", url: "https://www.youtube.com/", created_at: new Date().toISOString(), uploader_id: "demo" },
];

const demoAnnouncements: Announcement[] = [
  { id: "a1", title: "Mid-semester schedule published", body: "The mid-semester examination schedule is now available from the department office.", important: true, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "a2", title: "Project team registration", body: "Submit your project team details to your class monitor by Friday.", important: false, created_at: new Date(Date.now() - 86400000).toISOString() },
];

const demoAssignments: Assignment[] = [
  { id: "t1", title: "Binary tree implementation", description: "Implement insertion, deletion and traversal operations.", subject: "Data Structures", due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) },
  { id: "t2", title: "SQL query worksheet", description: "Complete exercises 1–15 and submit a single PDF.", subject: "Database Systems", due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) },
  { id: "t3", title: "Graph theory problem set", description: "Solve the tutorial questions from Unit 3.", subject: "Mathematics", due_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
];

const allowedPyqExtensions = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".jpg", ".jpeg", ".png", ".webp"] as const;
const pyqFileAccept = allowedPyqExtensions.join(",");
const pyqSchemaUpdateMessage = "PYQ tables exist, but their schema is outdated. Run the latest full supabase/pyqs.sql script in the connected project's SQL Editor, then refresh.";

const initialMembers: MemberEntry[] = [
  { id: "m-admin", full_name: "Department Admin", email: "2026eeb061.raihan@students.iiests.ac.in", role: "admin", status: "active" },
  { id: "m-monitor", full_name: "Class Monitor", email: "2026eeb201.monitor@students.iiests.ac.in", role: "monitor", status: "active" },
  { id: "m-student", full_name: "Student User", email: "2026eeb202.student@students.iiests.ac.in", role: "student", status: "active" },
];

/**
 * Supabase returns a 404 / PGRST205 ("Could not find the table ... in the schema
 * cache") when a table from schema.sql hasn't been created yet. Treat those as
 * "table not set up" so flows can fall back to the local store instead of
 * aborting with an error.
 */
function isMissingTableError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return err.code === "PGRST205" || err.code === "42P01" ||
    msg.includes("could not find the table") || (/\b(?:table|relation)\b/.test(msg) && msg.includes("does not exist"));
}

function isMissingColumnError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return err.code === "42703" || err.code === "PGRST204" ||
    (msg.includes("column") && (msg.includes("does not exist") || msg.includes("could not find")));
}

export default function Home() {
  const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
  const SESSION_KEY = "department-hub-session";
  const STORAGE_KEY = "department-hub-state";
  const SEEN_ANNOUNCEMENTS_KEY = "department-hub-seen-announcements";
  const SEEN_ASSIGNMENTS_KEY = "department-hub-seen-assignments";

  const readStoredState = () => {
    if (typeof window === "undefined") return null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        members?: MemberEntry[];
        materials?: Material[];
        subjectFolders?: Record<number, string[]>;
        demoPasswords?: Record<string, string>;
        announcements?: Announcement[];
        assignments?: Assignment[];
        completions?: Completion[];
        pyqCourses?: PyqCourse[];
        pyqFiles?: PyqFile[];
        courseSyllabi?: CourseSyllabus[];
        semester?: number;
      };

      return {
        members: Array.isArray(parsed.members) ? parsed.members : initialMembers,
        materials: Array.isArray(parsed.materials) ? parsed.materials : demoMaterials,
        subjectFolders: parsed.subjectFolders && typeof parsed.subjectFolders === "object" ? parsed.subjectFolders : (() => {
          const initial: Record<number, string[]> = {};
          demoMaterials.forEach((material) => {
            if (!initial[material.semester]) initial[material.semester] = [];
            if (!initial[material.semester].includes(material.subject)) initial[material.semester].push(material.subject);
          });
          return initial;
        })(),
        demoPasswords: parsed.demoPasswords && typeof parsed.demoPasswords === "object" ? parsed.demoPasswords : {
          "2026eeb201.monitor@students.iiests.ac.in": "Monitor01@",
          "2026eeb202.student@students.iiests.ac.in": "Student01@",
        },
        announcements: Array.isArray(parsed.announcements) ? parsed.announcements : demoAnnouncements,
        assignments: Array.isArray(parsed.assignments) ? parsed.assignments : demoAssignments,
        completions: Array.isArray(parsed.completions) ? parsed.completions : [{ assignment_id: "t1", done: true }],
        semester: Number.isInteger(parsed.semester) && (parsed.semester as number) >= 1 && (parsed.semester as number) <= 8 ? (parsed.semester as number) : undefined,
        pyqCourses: Array.isArray(parsed.pyqCourses) ? parsed.pyqCourses : [],
        pyqFiles: Array.isArray(parsed.pyqFiles)
          ? parsed.pyqFiles.map((file) => {
            const examType: PyqExamType = file.exam_type === "Mid-Sem" ? "Mid-Sem" : "End-Sem";
            return { ...file, exam_type: examType };
          })
          : [],
        courseSyllabi: Array.isArray(parsed.courseSyllabi) ? parsed.courseSyllabi : [],
      };
    } catch {
      return null;
    }
  };

  const [profile, setProfile] = useState<Profile | null>(null);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [themeMode, setThemeMode] = useState<"normal" | "dark">("dark");
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [section, setSection] = useState("Overview");
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [semester, setSemester] = useState(() => readStoredState()?.semester ?? 1);
  const [semesterDraft, setSemesterDraft] = useState(1);
  const [semesterBusy, setSemesterBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [pyqSemester, setPyqSemester] = useState(1);
  const [activePyqCourseId, setActivePyqCourseId] = useState<string | null>(null);
  const [activePyqExamType, setActivePyqExamType] = useState<PyqExamType | null>(null);
  const [subject, setSubject] = useState("All subjects");
  const [activeSubjectFolder, setActiveSubjectFolder] = useState<string | null>(null);
  const [activeCourseSubFolder, setActiveCourseSubFolder] = useState<"Notes" | "Youtube Lectures Link" | "E-Books" | "Syllabus" | null>(null);
  const [courseSubFolderSearch, setCourseSubFolderSearch] = useState("");
  const [materialKindPreset, setMaterialKindPreset] = useState<"file" | "link" | null>(null);
  const [materialCategoryPreset, setMaterialCategoryPreset] = useState<ResourceCategory | null>(null);
  const [subjectEditTarget, setSubjectEditTarget] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [subjectDeleteTarget, setSubjectDeleteTarget] = useState<string | null>(null);
  const [materialDeleteTarget, setMaterialDeleteTarget] = useState<Material | null>(null);
  const [materialDeleteBusy, setMaterialDeleteBusy] = useState(false);
  const [courseSyllabi, setCourseSyllabi] = useState<CourseSyllabus[]>(() => readStoredState()?.courseSyllabi ?? []);
  const [syllabusEditTarget, setSyllabusEditTarget] = useState<CourseSyllabus | null>(null);
  const [syllabusDeleteTarget, setSyllabusDeleteTarget] = useState<CourseSyllabus | null>(null);
  const [syllabusBusy, setSyllabusBusy] = useState(false);
  const [syllabusError, setSyllabusError] = useState("");
  const [courseMutationBusy, setCourseMutationBusy] = useState(false);
  const [materialSubjectPreset, setMaterialSubjectPreset] = useState<string | null>(null);
  const [pyqCourseEditTarget, setPyqCourseEditTarget] = useState<PyqCourse | null>(null);
  const [pyqCourseDraft, setPyqCourseDraft] = useState("");
  const [pyqCourseDeleteTarget, setPyqCourseDeleteTarget] = useState<PyqCourse | null>(null);
  const [pyqFileEditTarget, setPyqFileEditTarget] = useState<PyqFile | null>(null);
  const [pyqFileDeleteTarget, setPyqFileDeleteTarget] = useState<PyqFile | null>(null);
  const [subjectFolders, setSubjectFolders] = useState<Record<number, string[]>>(() => {
    const stored = readStoredState();
    return stored?.subjectFolders ?? (() => {
      const initial: Record<number, string[]> = {};
      demoMaterials.forEach((material) => {
        if (!initial[material.semester]) {
          initial[material.semester] = [];
        }
        if (!initial[material.semester].includes(material.subject)) {
          initial[material.semester].push(material.subject);
        }
      });
      return initial;
    })();
  });
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<"login" | "signup" | "forgot" | "material" | "delete-material" | "syllabus" | "delete-syllabus" | "pyq-course" | "pyq-share" | "pyq-edit-course" | "pyq-delete-course" | "pyq-edit-file" | "pyq-delete-file" | "subject" | "edit-course" | "delete-course" | "edit-semester" | "change-password" | "announcement" | "edit-announcement" | "delete-announcement" | "assignment" | "edit-assignment" | "delete-assignment" | "members" | "remove-member" | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"neutral" | "error">("neutral");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");
  const [announcementEditTarget, setAnnouncementEditTarget] = useState<Announcement | null>(null);
  const [announcementDeleteTarget, setAnnouncementDeleteTarget] = useState<Announcement | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [resetEmailTarget, setResetEmailTarget] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberEntry[]>(() => readStoredState()?.members ?? initialMembers);
  const [memberToRemove, setMemberToRemove] = useState<MemberEntry | null>(null);
  const [memberError, setMemberError] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>(() => readStoredState()?.materials ?? demoMaterials);
  const [pyqCourses, setPyqCourses] = useState<PyqCourse[]>(() => readStoredState()?.pyqCourses ?? []);
  const [pyqFiles, setPyqFiles] = useState<PyqFile[]>(() => readStoredState()?.pyqFiles ?? []);
  const [pyqsLoading, setPyqsLoading] = useState(false);
  const [pyqBusy, setPyqBusy] = useState(false);
  const [pyqError, setPyqError] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => readStoredState()?.announcements ?? demoAnnouncements);
  const [assignments, setAssignments] = useState<Assignment[]>(() => readStoredState()?.assignments ?? demoAssignments);
  const [completions, setCompletions] = useState<Completion[]>(() => readStoredState()?.completions ?? [{ assignment_id: "t1", done: true }]);
  const [lastSeenAnnouncementAt, setLastSeenAnnouncementAt] = useState<number | null>(null);
  const [lastSeenAssignmentAt, setLastSeenAssignmentAt] = useState<number | null>(null);
  const [assignmentsBacked, setAssignmentsBacked] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentEditTarget, setAssignmentEditTarget] = useState<Assignment | null>(null);
  const [assignmentDeleteTarget, setAssignmentDeleteTarget] = useState<Assignment | null>(null);
  const [demoPasswords, setDemoPasswords] = useState<Record<string, string>>(() => readStoredState()?.demoPasswords ?? {
    "2026eeb201.monitor@students.iiests.ac.in": "Monitor01@",
    "2026eeb202.student@students.iiests.ac.in": "Student01@",
  });
  const canPost = profile?.role === "monitor" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";
  const hasAuthenticatedSupabase = Boolean(configured && supabase && profile && !profile.id.endsWith("-preview"));
  const canManageCourseFolders = profile?.role === "monitor" || profile?.role === "admin";

  const adminEmail = "2026eeb061.raihan@students.iiests.ac.in";
  const isProtectedAdmin = (member: MemberEntry) => member.email.trim().toLowerCase() === adminEmail;
  const getRoleLabel = (email: string | null | undefined, role: Role | undefined) =>
    email?.trim().toLowerCase() === adminEmail ? "Superior Admin" : role || "Preview mode";
  const validStudentPrefix = /^2026eeb/i;
  const allowedEmailDomain = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || "college.edu").toLowerCase();
  const departmentName = process.env.NEXT_PUBLIC_DEPARTMENT_NAME || "IIEST EE'30";
  const collegeName = process.env.NEXT_PUBLIC_COLLEGE_NAME || "Your College";

  const isAllowedDepartmentEmail = (email: string) => {
    const normalized = email.trim().toLowerCase();
    return normalized.endsWith(`@${allowedEmailDomain}`) || validStudentPrefix.test(normalized) || normalized === adminEmail;
  };

  const canManageMaterials = profile?.role === "monitor" || profile?.role === "admin";

  const buildSubjectFolderMap = (rows?: Array<{ semester: number; name: string }> | null) => {
    const nextMap: Record<number, string[]> = {};
    (rows ?? []).forEach((row) => {
      if (!nextMap[row.semester]) nextMap[row.semester] = [];
      if (!nextMap[row.semester].includes(row.name)) nextMap[row.semester].push(row.name);
    });
    return nextMap;
  };

  const semesterSubjectFolders = useMemo(() => {
    const values = new Set<string>();
    materials.forEach((material) => {
      if (material.semester === semester) {
        values.add(material.subject);
      }
    });
    (subjectFolders[semester] ?? []).forEach((name) => values.add(name));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [materials, semester, subjectFolders]);

  const filteredSemesterFolders = useMemo(() => {
    if (!query.trim()) return semesterSubjectFolders;
    const q = query.toLowerCase();
    return semesterSubjectFolders.filter((folderName) => {
      if (folderName.toLowerCase().includes(q)) return true;
      return materials.some(
        (m) => m.semester === semester && m.subject === folderName && m.title.toLowerCase().includes(q)
      );
    });
  }, [semesterSubjectFolders, query, materials, semester]);

  const subjects = useMemo(
    () => ["All subjects", ...semesterSubjectFolders],
    [semesterSubjectFolders],
  );

  const visibleMaterials = materials.filter(
    (m) =>
      m.semester === semester &&
      (activeSubjectFolder ? m.subject === activeSubjectFolder : subject === "All subjects" || m.subject === subject) &&
      m.title.toLowerCase().includes(query.toLowerCase()),
  );
  const visiblePyqCourses = pyqCourses.filter((course) => course.semester === pyqSemester);
  const activePyqCourse = pyqCourses.find((course) => course.id === activePyqCourseId) ?? null;
  const visiblePyqFiles = activePyqCourse && activePyqExamType
    ? pyqFiles.filter((file) => file.course_id === activePyqCourse.id && (file.exam_type ?? "End-Sem") === activePyqExamType)
    : [];

  const completedCount = completions.filter((c) => c.done).length;
  const pending = assignments.filter((a) => !completions.find((c) => c.assignment_id === a.id)?.done);
  const upcoming = pending.filter((a) => a.due_date >= new Date().toISOString().slice(0, 10));
  const overdue = pending.filter((a) => a.due_date < new Date().toISOString().slice(0, 10));

  // Announcements newer than the last time this user opened the Announcements section.
  // A null lastSeen (never opened) counts every announcement as unread.
  const unreadAnnouncementCount = useMemo(() => {
    const seenAt = lastSeenAnnouncementAt ?? 0;
    return announcements.filter((a) => {
      const ts = new Date(a.created_at).getTime();
      return Number.isFinite(ts) && ts > seenAt;
    }).length;
  }, [announcements, lastSeenAnnouncementAt]);

  // Assignments newer than the last time this user opened the Assignments section.
  // Demo items without a timestamp count as unread until the section is opened once.
  const unreadAssignmentCount = useMemo(() => {
    const seenAt = lastSeenAssignmentAt ?? 0;
    return assignments.filter((a) => {
      const ts = a.created_at ? new Date(a.created_at).getTime() : NaN;
      if (!Number.isFinite(ts)) return seenAt === 0;
      return ts > seenAt;
    }).length;
  }, [assignments, lastSeenAssignmentAt]);

  const nav = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Study materials", icon: BookOpen },
    { name: "PYQs", icon: FolderOpen },
    { name: "Announcements", icon: Bell },
    { name: "Assignments", icon: CalendarDays },
  ];

  const previewAccounts = useMemo<Record<string, { full_name: string; role: Role; password: string; status: MemberStatus }>>(() => {
    const base: Record<string, { full_name: string; role: Role; password: string; status: MemberStatus }> = {
      "2026eeb061.raihan@students.iiests.ac.in": { full_name: "Department Admin", role: "admin", password: "", status: "active" },
    };

    for (const member of members) {
      const normalized = member.email.toLowerCase();
      const password = demoPasswords[normalized] || base[normalized]?.password || "";
      base[normalized] = {
        full_name: member.full_name,
        role: member.role,
        password,
        status: member.status,
      };
    }

    return base;
  }, [demoPasswords, members]);

  const matchPassword = (email: string, password: string) => {
    const realPassword = demoPasswords[email] || previewAccounts[email]?.password || "";
    return realPassword && realPassword === password;
  };

  const showNotice = (message: string, tone: "neutral" | "error" = "neutral") => {
    setNotice(message);
    setNoticeTone(tone);
  };

  // Toasts disappear on their own after 3 seconds (resets whenever a new notice appears).
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice("");
      setNoticeTone("neutral");
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function hashFile(file: File) {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }

  async function resolveMaterialUrl(file: File | null, purpose?: "syllabus" | "assignment"): Promise<{ url: string; fileName: string }> {
    if (!file || file.size === 0) {
      return { url: "", fileName: "" };
    }

    if (file.size > 104857600) {
      throw new Error("File is too large. Maximum allowed size is 100 MB.");
    }

    // Vercel serverless functions reject request bodies larger than ~4.5 MB
    // (FUNCTION_PAYLOAD_TOO_LARGE), which made every bigger upload die with a
    // generic "Upload failed". For anything above 4 MB, start a resumable
    // session on the server and stream the file straight to Google Drive from
    // the browser — the large body never passes through Vercel.
    const VERCEL_BODY_LIMIT = 4 * 1024 * 1024;
    if (file.size > VERCEL_BODY_LIMIT) {
      setUploadProgress(`Preparing upload for ${file.name}…`);

      try {
        const initRes = await fetch("/api/upload/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: await getStaffAuthorizationHeader(),
          },
          body: JSON.stringify({
            fileName: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
            purpose: purpose ?? null,
          }),
        });

        if (!initRes.ok) {
          const errJson = await initRes.json().catch(() => null);
          throw new Error(errJson?.error || "Could not start the upload. Please try again.");
        }

        const { uploadUrl } = await initRes.json();
        if (!uploadUrl) {
          throw new Error("Could not start the upload. Please try again.");
        }

        const putOutcome = await new Promise<{ status: number; text: string }>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(`Uploading ${file.name}… ${percent}%`);
            }
          };
          xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText || "" });
          // A status of 0 means the browser blocked Google's response (CORS) —
          // the upload itself may still have succeeded, so resolve and verify
          // server-side instead of failing here.
          xhr.onerror = () => resolve({ status: 0, text: "" });
          xhr.send(file);
        });

        let driveFileId: string | null = null;
        try {
          const parsed = putOutcome.text ? JSON.parse(putOutcome.text) : null;
          driveFileId = parsed?.id ?? null;
        } catch {
          driveFileId = null;
        }

        if (!driveFileId) {
          // Google's PUT response is not CORS-readable from the browser —
          // confirm the finished file server-side by name and byte size.
          setUploadProgress(`Finishing upload for ${file.name}…`);
          try {
            const lookupRes = await fetch(
              `/api/upload/lookup?name=${encodeURIComponent(file.name)}&size=${String(file.size)}`,
              { headers: { Authorization: await getStaffAuthorizationHeader() } }
            );
            if (lookupRes.ok) {
              const result = await lookupRes.json().catch(() => null);
              driveFileId = result?.fileId ?? null;
            }
          } catch {
            // fall through to the error below
          }
        }

        if (!driveFileId) {
          const completedBlind = putOutcome.status === 0 || (putOutcome.status >= 200 && putOutcome.status < 300);
          throw new Error(
            completedBlind
              ? "Upload finished but could not be verified. Please try again."
              : `Upload failed (${putOutcome.status}). Please try again.`
          );
        }

        return {
          url: `https://drive.google.com/uc?export=download&id=${driveFileId}`,
          fileName: file.name,
        };
      } finally {
        setUploadProgress(null);
      }
    }

    setUploadProgress(`Uploading ${file.name}…`);

    const formData = new FormData();
    formData.append("file", file);
    if (purpose) formData.append("purpose", purpose);

    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: await getStaffAuthorizationHeader() },
      body: formData,
    });

    setUploadProgress(null);

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.error || "Upload failed. Please try again.");
    }

    const payload = await response.json();
    if (!payload?.url) {
      throw new Error("Upload succeeded but no URL was returned.");
    }

    return {
      url: payload.url,
      fileName: payload.fileName || file.name,
    };
  }

  async function getStaffAuthorizationHeader(): Promise<string> {
    if (!hasAuthenticatedSupabase || !supabase) {
      throw new Error("Sign in with an admin or monitor account to make shared changes.");
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message || "Could not verify your staff session.");
    }
    if (!data.session?.access_token) {
      throw new Error("Your session has expired. Sign in again.");
    }
    return `Bearer ${data.session.access_token}`;
  }

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(new Date());
    updateCurrentTime();

    const intervalId = window.setInterval(updateCurrentTime, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset_token");
    const email = params.get("email");

    if (configured && supabase) {
      const { data: authState } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && session?.user?.email) {
          setResetToken("recovery");
          setResetEmailTarget(session.user.email);
          setModal("forgot");
          setNotice("Use the form below to set a new password.");
        }
      });

      return () => {
        authState.subscription.unsubscribe();
      };
    }

    if (token && email) {
      setResetToken(token);
      setResetEmailTarget(email);
      setModal("forgot");
      setNotice("Use the form below to set a new password.");
    }
  }, []);

  // Surface OAuth errors (for example a non-college Google account rejected by
  // the database trigger) instead of leaving them in the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = search.get("error") || hash.get("error") || search.get("error_code") || hash.get("error_code");
    if (!errorCode) return;

    if (errorCode !== "access_denied") {
      const description = search.get("error_description") || hash.get("error_description") || "";
      let decoded = description;
      try {
        decoded = decodeURIComponent(description.replace(/\+/g, " "));
      } catch {
        decoded = description;
      }
      const friendly = /database error|only approved department/i.test(decoded)
        ? `Only ${collegeName} department accounts can sign in here.`
        : decoded.trim() || "Google sign-in could not be completed.";
      showNotice(friendly, "error");
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.hash = "";
    nextUrl.searchParams.delete("error");
    nextUrl.searchParams.delete("error_code");
    nextUrl.searchParams.delete("error_description");
    window.history.replaceState({}, "", nextUrl.pathname + nextUrl.search);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromStorage = () => {
      const storedState = readStoredState();
      if (storedState) {
        setMembers(storedState.members);
        setMaterials(storedState.materials);
        setSubjectFolders(storedState.subjectFolders);
        setDemoPasswords(storedState.demoPasswords);
        setPyqCourses(storedState.pyqCourses);
        setPyqFiles(storedState.pyqFiles);
      }
    };

    syncFromStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener("storage", handleStorage);

    const restoreSession = async () => {
      try {
        const savedSession = localStorage.getItem(SESSION_KEY);
        if (savedSession) {
          const parsed = JSON.parse(savedSession) as { profile?: Profile; expiresAt?: number };
          if (parsed.profile && parsed.expiresAt && Date.now() <= parsed.expiresAt) {
            const resolvedProfile = parsed.profile.email.toLowerCase() === adminEmail.toLowerCase()
              ? { ...parsed.profile, role: "admin" as Role }
              : parsed.profile;

            const restoreProfile = () => {
              setProfile(resolvedProfile);
              setModal(null);
            };

            if (configured && supabase && !resolvedProfile.id.endsWith("-preview")) {
              // The local UI session can outlive the real Supabase auth session
              // (JWTs expire after ~1 hour and refresh tokens are revoked when
              // the same account signs in from several browsers). Restoring the
              // profile without validating the auth session made every write
              // fail with confusing errors like "Could not save the course…".
              try {
                const { error: userError } = await supabase.auth.getUser();
                const isNetworkError = (userError as { name?: string } | null)?.name === "AuthRetryableFetchError";
                if (userError && !isNetworkError) {
                  localStorage.removeItem(SESSION_KEY);
                  setModal("login");
                } else {
                  restoreProfile();
                }
              } catch {
                restoreProfile();
              }
            } else {
              restoreProfile();
            }
          } else {
            localStorage.removeItem(SESSION_KEY);
          }
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }

      // Returned from Google sign-in (or a still-valid Supabase session with no
      // local app session): adopt it and load the matching profile.
      if (!localStorage.getItem(SESSION_KEY) && configured && supabase) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const session = sessionData.session;
          const sessionEmail = session?.user?.email?.toLowerCase() || "";

          if (session && sessionEmail) {
            if (!isAllowedDepartmentEmail(sessionEmail)) {
              await supabase.auth.signOut();
              showNotice(`Only ${collegeName} department accounts can sign in here.`, "error");
            } else {
              const { data: profileRow } = await supabase
                .from("profiles")
                .select("email, full_name, role")
                .eq("email", sessionEmail)
                .maybeSingle();

              const role = sessionEmail === adminEmail
                ? "admin"
                : (profileRow?.role as Role | undefined) || "student";
              const fullName = (profileRow?.full_name as string | null)
                || (session.user.user_metadata?.full_name as string | undefined)
                || (session.user.user_metadata?.name as string | undefined)
                || sessionEmail;

              setProfile({ id: session.user.id, email: sessionEmail, full_name: fullName, role, status: "active" });
              setModal(null);
              showNotice(`Logged in as ${fullName}.`);

              // Drop the OAuth tokens from the address bar once adopted.
              if (window.location.hash) {
                window.history.replaceState({}, "", window.location.pathname + window.location.search);
              }
            }
          }
        } catch {
          // Manual sign-in still works if the session cannot be read.
        }
      }

      setIsSessionReady(true);
    };

    void restoreSession();

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [SESSION_KEY, STORAGE_KEY]);

  // Clear the in-course sub-folder search whenever the user navigates
  // (switching folder, course, or semester).
  useEffect(() => {
    setCourseSubFolderSearch("");
  }, [activeCourseSubFolder, activeSubjectFolder, semester]);

  useEffect(() => {
    const loadSharedMaterials = async () => {
      try {
        const res = await fetch("/api/materials");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.materials)) {
            setMaterials((prev) => {
              if (hasAuthenticatedSupabase) {
                // Signed-in staff: Supabase is the single source of truth.
                // Replace the list outright so deletions and edits made in any
                // browser propagate everywhere (and stale per-browser cache
                // copies can never resurrect phantom folders).
                return data.materials;
              }
              // Not authenticated (preview/local mode): merge shared rows
              // into the cached list without dropping anything.
              const sharedIds = new Set(data.materials.map((m: Material) => m.id));
              const nonDuplicatePrev = prev.filter((p) => !sharedIds.has(p.id));
              return [...data.materials, ...nonDuplicatePrev];
            });
          }
        }
      } catch {
        // Fall back to cached materials
      }
    };

    void loadSharedMaterials();
  }, [hasAuthenticatedSupabase]);

  useEffect(() => {
    if (!configured || !supabase || !profile) return;

    const client = supabase;

    const loadSharedCourseFolders = async () => {
      try {
        const { data, error } = await client
          .from("course_folders")
          .select("semester, name")
          .order("semester", { ascending: true })
          .order("name", { ascending: true });

        if (error) {
          return;
        }

        const nextFolders = buildSubjectFolderMap(data ?? []);
        if (Object.keys(nextFolders).length > 0) {
          setSubjectFolders(nextFolders);
        }
      } catch {
        // Silently fall back to default/cached course folders
      }
    };

    void loadSharedCourseFolders();
  }, [configured, profile]);

  useEffect(() => {
    if (!hasAuthenticatedSupabase || !supabase) return;

    let active = true;
    const client = supabase;
    const loadAnnouncements = async () => {
      try {
        const { data, error } = await client
          .from("announcements")
          .select("id, title, body, important, created_at")
          .order("created_at", { ascending: false });

        if (error) {
          if (active && isMissingTableError(error)) {
            showNotice("Supabase is missing public.announcements. Run supabase/announcements.sql in the SQL Editor.", "error");
          } else if (active) {
            showNotice("Could not load announcements from Supabase.", "error");
          }
          return;
        }

        if (active) setAnnouncements((data ?? []) as Announcement[]);
      } catch (error) {
        if (active) {
          showNotice(error instanceof Error ? error.message : "Could not load announcements from Supabase.", "error");
        }
      }
    };

    void loadAnnouncements();
    return () => {
      active = false;
    };
  }, [hasAuthenticatedSupabase, profile?.id]);

  // Load this user's saved "last seen announcements" marker on login.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!profile) {
      setLastSeenAnnouncementAt(null);
      return;
    }
    try {
      const raw = localStorage.getItem(SEEN_ANNOUNCEMENTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as { email?: string; ts?: number }) : null;
      setLastSeenAnnouncementAt(parsed?.email === profile.email && typeof parsed.ts === "number" ? parsed.ts : null);
    } catch {
      setLastSeenAnnouncementAt(null);
    }
  }, [profile, SEEN_ANNOUNCEMENTS_KEY]);

  // Opening the Announcements section marks everything as seen.
  useEffect(() => {
    if (section !== "Announcements" || !profile) return;
    const ts = Date.now();
    setLastSeenAnnouncementAt(ts);
    try {
      localStorage.setItem(SEEN_ANNOUNCEMENTS_KEY, JSON.stringify({ email: profile.email, ts }));
    } catch {
      // Non-fatal: the badge will just reset again next session
    }
  }, [section, profile, SEEN_ANNOUNCEMENTS_KEY]);

  // Load this user's saved "last seen assignments" marker on login.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!profile) {
      setLastSeenAssignmentAt(null);
      return;
    }
    try {
      const raw = localStorage.getItem(SEEN_ASSIGNMENTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as { email?: string; ts?: number }) : null;
      setLastSeenAssignmentAt(parsed?.email === profile.email && typeof parsed.ts === "number" ? parsed.ts : null);
    } catch {
      setLastSeenAssignmentAt(null);
    }
  }, [profile, SEEN_ASSIGNMENTS_KEY]);

  // Opening the Assignments section marks everything as seen.
  useEffect(() => {
    if (section !== "Assignments" || !profile) return;
    const ts = Date.now();
    setLastSeenAssignmentAt(ts);
    try {
      localStorage.setItem(SEEN_ASSIGNMENTS_KEY, JSON.stringify({ email: profile.email, ts }));
    } catch {
      // Non-fatal: the badge will just reset again next session
    }
  }, [section, profile, SEEN_ASSIGNMENTS_KEY]);

  useEffect(() => {
    if (!hasAuthenticatedSupabase || !supabase || !profile) return;

    let active = true;
    const client = supabase;
    const loadAssignments = async () => {
      try {
        let rows: Assignment[] | null = null;
        const { data, error } = await client
          .from("assignments")
          .select("id, title, description, subject, due_date, created_at, attachment_url, file_name")
          .order("due_date", { ascending: true });

        if (!error && Array.isArray(data)) {
          rows = data as Assignment[];
        } else if (error && (error.message?.includes("attachment_url") || error.message?.includes("file_name"))) {
          const fallbackRes = await client
            .from("assignments")
            .select("id, title, description, subject, due_date, created_at")
            .order("due_date", { ascending: true });
          if (!fallbackRes.error && Array.isArray(fallbackRes.data)) {
            rows = fallbackRes.data as Assignment[];
          }
        } else if (error && !isMissingTableError(error)) {
          if (active) showNotice("Could not load assignments from Supabase.", "error");
          return;
        }

        if (!active) return;

        if (Array.isArray(rows)) {
          setAssignments(rows);
          setAssignmentsBacked(true);

          const { data: completionRows, error: completionError } = await client
            .from("assignment_completions")
            .select("assignment_id, done")
            .eq("student_id", profile.id);

          if (!completionError && active) {
            setCompletions((completionRows ?? []) as Completion[]);
          }
        }
      } catch {
        // Keep demo assignments when the table is not set up yet
      }
    };

    void loadAssignments();
    return () => {
      active = false;
    };
  }, [hasAuthenticatedSupabase, profile?.id]);

  useEffect(() => {
    if (!hasAuthenticatedSupabase || !supabase) return;

    let active = true;
    const client = supabase;
    const loadCourseSyllabi = async () => {
      try {
        const { data, error } = await client
          .from("course_syllabi")
          .select("id, semester, subject, file_name, url, uploader_id, updated_at")
          .order("semester")
          .order("subject");

        if (!active) return;
        if (error) {
          setSyllabusError(isMissingTableError(error)
            ? "Syllabus storage is not set up in Supabase. Run supabase/course_syllabi.sql in the SQL Editor."
            : error.message || "Could not load course syllabi.");
          return;
        }

        setCourseSyllabi((data ?? []) as CourseSyllabus[]);
        setSyllabusError("");
      } catch (error) {
        if (active) {
          setSyllabusError(error instanceof Error ? error.message : "Could not load course syllabi.");
        }
      }
    };

    void loadCourseSyllabi();
    return () => {
      active = false;
    };
  }, [hasAuthenticatedSupabase]);

  // Load the shared "current semester" that staff set for the whole department.
  useEffect(() => {
    if (!hasAuthenticatedSupabase || !supabase) return;

    let active = true;
    const client = supabase;
    const loadCurrentSemester = async () => {
      try {
        const { data, error } = await client
          .from("department_settings")
          .select("value")
          .eq("key", "current_semester")
          .maybeSingle();

        if (error && !isMissingTableError(error)) return;
        if (!active) return;

        const parsed = Number(data?.value);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 8) {
          setSemester(parsed);
        }
      } catch {
        // Keep the local semester when the settings table is not set up yet
      }
    };

    void loadCurrentSemester();
    return () => {
      active = false;
    };
  }, [hasAuthenticatedSupabase]);

  useEffect(() => {
    if (!hasAuthenticatedSupabase || !supabase || !profile) return;

    let active = true;
    const client = supabase;
    const loadPyqs = async () => {
      setPyqsLoading(true);
      setPyqError("");
      try {
        const [coursesResult, filesResult] = await Promise.all([
          client.from("pyq_course_folders").select("id, semester, name").order("semester").order("name"),
          client.from("pyq_materials").select("id, course_id, exam_type, title, file_name, url, created_at, uploader_id").order("created_at", { ascending: false }),
        ]);

        const error = coursesResult.error || filesResult.error;
        if (error) {
          if (active) {
            const message = isMissingTableError(error)
              ? "PYQ tables are missing from the connected Supabase project. Run the full supabase/pyqs.sql script in that project's SQL Editor, then refresh."
              : isMissingColumnError(error)
                ? pyqSchemaUpdateMessage
                : error.message || "Could not load PYQs from Supabase.";
            setPyqError(message);
          }
          return;
        }

        if (active) {
          setPyqCourses((coursesResult.data ?? []) as PyqCourse[]);
          setPyqFiles((filesResult.data ?? []) as PyqFile[]);
        }
      } catch (error) {
        if (active) {
          setPyqError(error instanceof Error ? error.message : "Could not load PYQs from Supabase.");
        }
      } finally {
        if (active) setPyqsLoading(false);
      }
    };

    void loadPyqs();
    return () => {
      active = false;
      setPyqsLoading(false);
    };
  }, [hasAuthenticatedSupabase, profile?.id]);

  useEffect(() => {
    if (!isAdmin || modal !== "members" || !hasAuthenticatedSupabase || !supabase) return;

    let active = true;
    const client = supabase;
    const loadMembers = async () => {
      setMembersLoading(true);
      setMemberError("");
      try {
        const { data, error } = await client
          .from("profiles")
          .select("id, email, full_name, role")
          .order("email", { ascending: true });

        if (error) {
          if (active) {
            setMembers([]);
            setMemberError(error.message || "Could not load department members.");
          }
          return;
        }

        if (active) {
          setMembers((data ?? []).map((member) => ({
            id: member.id,
            full_name: member.full_name || member.email,
            email: member.email,
            role: member.role as Role,
            status: "active",
          })));
        }
      } catch (error) {
        if (active) {
          setMembers([]);
          setMemberError(error instanceof Error ? error.message : "Could not load department members.");
        }
      } finally {
        if (active) setMembersLoading(false);
      }
    };

    void loadMembers();
    return () => {
      active = false;
      setMembersLoading(false);
    };
  }, [hasAuthenticatedSupabase, isAdmin, modal, profile?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (profile) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ profile, expiresAt: Date.now() + SESSION_TTL_MS }));
      return;
    }

    localStorage.removeItem(SESSION_KEY);
  }, [profile, SESSION_KEY, SESSION_TTL_MS]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        members,
        materials,
        subjectFolders,
        demoPasswords,
        announcements,
        assignments,
        completions,
        semester,
        pyqCourses,
        pyqFiles,
        courseSyllabi,
      }),
    );
  }, [STORAGE_KEY, members, materials, subjectFolders, demoPasswords, announcements, assignments, completions, semester, pyqCourses, pyqFiles, courseSyllabi]);

  useEffect(() => {
    if (!profile && modal === null && isSessionReady) {
      setModal("login");
    }
  }, [profile, modal, isSessionReady]);

  async function authSubmit(e: React.FormEvent<HTMLFormElement>, mode: "login" | "signup" | "forgot") {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    setNoticeTone("neutral");

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");

    if (!configured || !supabase) {
      if (mode === "signup") {
        if (!validStudentPrefix.test(email) && !email.endsWith(`@${allowedEmailDomain}`)) {
          showNotice("Only department of Electrical Engineering'30 IIEST Shibpur Can Register", "error");
          setBusy(false);
          return;
        }

        if (!email.endsWith(`@${allowedEmailDomain}`) && !validStudentPrefix.test(email)) {
          showNotice("Only department of Electrical Engineering'30 IIEST Shibpur Can Register", "error");
          setBusy(false);
          return;
        }

        const existing = demoPasswords[email] || previewAccounts[email];
        if (existing) {
          showNotice("This account already exists. Use the sign-in form to continue.", "error");
          setBusy(false);
          return;
        }

        const name = String(fd.get("name") || "Student User").trim() || "Student User";
        const newPassword = password || "Student01@";
        setDemoPasswords((prev) => ({ ...prev, [email]: newPassword }));
        setMembers((prev) => [...prev, { id: `member-${Date.now()}`, full_name: name, email, role: "student", status: "active" }]);
        setProfile(null);
        setModal("login");
        showNotice(`Account created successfully for ${name}. Please sign in.`, "neutral");
        setBusy(false);
        return;
      }

      if (mode === "forgot") {
        const resetStep = Boolean(resetToken && resetEmailTarget);
        const targetEmail = resetEmailTarget || email;

        if (!resetStep) {
          if (!email) {
            setNotice("Enter your account email to reset the password.");
            setBusy(false);
            return;
          }

          if (!isAllowedDepartmentEmail(email)) {
            showNotice(`Only ${collegeName} department accounts can reset passwords here.`, "error");
            setBusy(false);
            return;
          }

          const knownAccount = previewAccounts[email] || members.some((member) => member.email.toLowerCase() === email);
          if (!knownAccount) {
            setNotice("No account was found for that email address.");
            setBusy(false);
            return;
          }

          const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set("reset_token", token);
          nextUrl.searchParams.set("email", email);
          window.history.replaceState({}, "", nextUrl);
          setResetToken(token);
          setResetEmailTarget(email);
          setModal("forgot");
          setNotice(`Password reset link sent to ${email}. Open the link in your inbox to set a new password.`);
          setBusy(false);
          return;
        }

        const nextPassword = String(fd.get("new_password") || "").trim();
        if (!targetEmail) {
          setNotice("Reset link is missing the account email.");
          setBusy(false);
          return;
        }

        if (!nextPassword || nextPassword.length < 8) {
          setNotice("Use a password with at least 8 characters.");
          setBusy(false);
          return;
        }

        setDemoPasswords((prev) => ({ ...prev, [targetEmail]: nextPassword }));
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("reset_token");
        nextUrl.searchParams.delete("email");
        window.history.replaceState({}, "", nextUrl);
        setResetToken(null);
        setResetEmailTarget(null);
        setModal("login");
        setNotice(`Password reset successful for ${targetEmail}. Please sign in with your new password.`);
        setBusy(false);
        return;
      }

      const account = previewAccounts[email];
      const userStatus = members.find((member) => member.email.toLowerCase() === email)?.status || "active";
      if (account && matchPassword(email, password) && userStatus === "active") {
        setProfile({ id: `${account.role}-preview`, email, full_name: account.full_name, role: account.role, status: account.status });
        setModal(null);
        showNotice(`Logged in as ${account.full_name}.`, "neutral");
      } else if (userStatus === "disabled") {
        showNotice("This account is disabled by the department admin.", "error");
      } else {
        showNotice(`Wrong password. Please try again.`, "error");
      }
      setBusy(false);
      return;
    }

    if (mode === "signup") {
      if (!validStudentPrefix.test(email) && !email.endsWith(`@${allowedEmailDomain}`)) {
        setNotice("Only department of Electrical Engineering'30 IIEST Shibpur Can Register");
        setBusy(false);
        return;
      }

      if (!email.endsWith(`@${allowedEmailDomain}`) && !validStudentPrefix.test(email)) {
        setNotice("Only department of Electrical Engineering'30 IIEST Shibpur Can Register");
        setBusy(false);
        return;
      }

      const name = String(fd.get("name") || "Student User").trim() || "Student User";
      // Accounts are created server-side with the service key so signup never
      // depends on Supabase's (unconfigured) confirmation emails.
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName: name }),
      });

      if (!signupRes.ok) {
        const payload = await signupRes.json().catch(() => null);
        showNotice(payload?.error || "Unable to create the account right now.", "error");
        setBusy(false);
        return;
      }

      setMembers((prev) => {
        const alreadyExists = prev.some((member) => member.email.toLowerCase() === email.toLowerCase());
        if (alreadyExists) return prev;
        return [...prev, { id: `member-${Date.now()}`, full_name: name, email, role: "student", status: "active" }];
      });

      setProfile(null);
      setModal("login");
      setNotice("Account created. Sign in with your password.");
      setNoticeTone("neutral");

      setBusy(false);
      return;
    }

    if (mode === "forgot") {
      const isRecovery = Boolean(resetToken && resetEmailTarget);
      const targetEmail = resetEmailTarget || email;

      if (!isRecovery) {
        if (!email) {
          setNotice("Enter your account email to reset the password.");
          setBusy(false);
          return;
        }

        if (!isAllowedDepartmentEmail(email)) {
          showNotice(`Only ${collegeName} department accounts can reset passwords here.`, "error");
          setBusy(false);
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
        });

        if (error) {
          setNotice(error.message || "Unable to send the reset email.");
          setBusy(false);
          return;
        }

        setResetEmailTarget(email);
        setModal("forgot");
        setNotice(`Password reset link sent to ${email}. Check your inbox and click the link to continue.`);
        setBusy(false);
        return;
      }

      const nextPassword = String(fd.get("new_password") || "").trim();
      if (!targetEmail) {
        setNotice("Reset link is missing the account email.");
        setBusy(false);
        return;
      }

      if (!nextPassword || nextPassword.length < 8) {
        setNotice("Use a password with at least 8 characters.");
        setBusy(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) {
        setNotice(error.message || "Unable to update the password right now.");
        setBusy(false);
        return;
      }

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("reset_token");
      nextUrl.searchParams.delete("email");
      nextUrl.hash = "";
      window.history.replaceState({}, "", nextUrl);
      setResetToken(null);
      setResetEmailTarget(null);
      setModal("login");
      setNotice(`Password reset successful for ${targetEmail}. Please sign in with your new password.`);
      setBusy(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showNotice(error.message || "Wrong password. Please try again.", "error");
      setBusy(false);
      return;
    }

    const userEmail = data.user?.email || email;
    const { data: profileRow } = await supabase.from("profiles").select("email, full_name, role").eq("email", userEmail).maybeSingle();
    const role = userEmail.toLowerCase() === adminEmail
      ? "admin"
      : (profileRow?.role as Role | undefined) || "student";

    setProfile({
      id: data.user?.id || userEmail,
      email: userEmail,
      full_name: (profileRow?.full_name as string | null) || data.user?.user_metadata?.full_name || (userEmail.toLowerCase() === adminEmail.toLowerCase() ? "Department Admin" : userEmail),
      role,
      status: "active",
    });
    setModal(null);
    setNotice(`Logged in as ${(profileRow?.full_name as string | null) || data.user?.user_metadata?.full_name || (userEmail.toLowerCase() === adminEmail.toLowerCase() ? "Department Admin" : userEmail)}.`);
    setBusy(false);
  }

  async function signInWithGoogle() {
    if (!configured || !supabase) {
      showNotice("Google sign-in is not available right now.", "error");
      return;
    }

    setBusy(true);
    setGoogleBusy(true);
    setNotice("");
    setNoticeTone("neutral");

    try {
      // Google OAuth is enabled in the Supabase dashboard, not in code. Check
      // first so a disabled provider shows a friendly message here instead of
      // navigating to Supabase's raw JSON error page.
      const statusRes = await fetch("/api/auth/google/status", { cache: "no-store" }).catch(() => null);
      const statusPayload = statusRes?.ok ? await statusRes.json().catch(() => null) : null;
      if (!statusPayload?.enabled) {
        showNotice("Google sign-in is not switched on yet. Please use your college email and password.", "error");
        setBusy(false);
        setGoogleBusy(false);
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
          queryParams: {
            prompt: "select_account",
            hd: allowedEmailDomain,
          },
        },
      });

      if (error) {
        showNotice(error.message || "Could not start Google sign-in.", "error");
        setBusy(false);
        setGoogleBusy(false);
      }
      // On success Supabase redirects the browser to Google; the session is
      // adopted when the user comes back.
    } catch {
      showNotice("Could not start Google sign-in.", "error");
      setBusy(false);
      setGoogleBusy(false);
    }
  }

  function handleAddSubject() {
    if (!canManageCourseFolders) {
      setNotice("Only admins, superior admins and monitors can add subject folders.");
      return;
    }
    setModal("subject");
  }

  function openAddPyqCourse() {
    if (!canManageMaterials) {
      showNotice("Only admins and monitors can add PYQ courses.", "error");
      return;
    }
    setPyqError("");
    setModal("pyq-course");
  }

  function openSharePyqFile() {
    if (!canManageMaterials) {
      showNotice("Only admins and monitors can share PYQ files.", "error");
      return;
    }
    if (!activePyqCourseId) {
      setPyqError("Select a course before sharing a PYQ file.");
      return;
    }
    if (!activePyqExamType) {
      setPyqError("Select Mid-Sem or End-Sem before sharing a PYQ file.");
      return;
    }
    setPyqError("");
    setModal("pyq-share");
  }

  function openEditPyqCourse(course: PyqCourse) {
    if (!canManageMaterials) {
      showNotice("Only admins and monitors can edit PYQ courses.", "error");
      return;
    }
    setPyqError("");
    setPyqCourseEditTarget(course);
    setPyqCourseDraft(course.name);
    setModal("pyq-edit-course");
  }

  function openDeletePyqCourse(course: PyqCourse) {
    if (!canManageMaterials) {
      showNotice("Only admins and monitors can delete PYQ courses.", "error");
      return;
    }
    setPyqError("");
    setPyqCourseDeleteTarget(course);
    setModal("pyq-delete-course");
  }

  function openEditPyqFile(file: PyqFile) {
    if (!canManageMaterials) {
      showNotice("Only admins and monitors can edit PYQ files.", "error");
      return;
    }
    setPyqError("");
    setPyqFileEditTarget(file);
    setModal("pyq-edit-file");
  }

  function openDeletePyqFile(file: PyqFile) {
    if (!canManageMaterials) {
      showNotice("Only admins and monitors can delete PYQ files.", "error");
      return;
    }
    setPyqError("");
    setPyqFileDeleteTarget(file);
    setModal("pyq-delete-file");
  }

  async function changeMemberRole(member: MemberEntry, role: Role) {
    if (!isAdmin) {
      showNotice("Only admins can manage members.", "error");
      return;
    }
    if (isProtectedAdmin(member) && role !== "admin") {
      setMemberError("This account must remain an admin.");
      return;
    }
    setMemberError("");

    if (hasAuthenticatedSupabase && supabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(member.id)) {
      setMemberBusy(true);
      setMemberError("");
      try {
        const { data, error } = await supabase
          .from("profiles")
          .update({ role })
          .eq("id", member.id)
          .select("id")
          .maybeSingle();

        if (error) {
          setMemberError(error.message || "Could not update the member role.");
          return;
        }
        if (!data) {
          setMemberError("Member not found or you do not have permission to change this role.");
          return;
        }
      } catch (error) {
        setMemberError(error instanceof Error ? error.message : "Could not update the member role.");
        return;
      } finally {
        setMemberBusy(false);
      }
    }

    setMembers((prev) => prev.map((item) => item.id === member.id ? { ...item, role } : item));
  }

  function openRemoveMember(member: MemberEntry) {
    if (!isAdmin) {
      showNotice("Only admins can remove members.", "error");
      return;
    }
    if (isProtectedAdmin(member)) {
      setMemberError("This admin account cannot be removed.");
      return;
    }
    setMemberError("");
    setMemberToRemove(member);
    setModal("remove-member");
  }

  async function removeMember() {
    if (!isAdmin || !memberToRemove) {
      setMemberError("Only admins can remove members.");
      return;
    }
    if (!hasAuthenticatedSupabase || !supabase) {
      setMemberError("Sign in with an authenticated Supabase admin account to remove members.");
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberToRemove.id)) {
      setMemberError("This preview member is not a Supabase account and cannot be permanently removed.");
      return;
    }

    setMemberBusy(true);
    setMemberError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error(sessionError?.message || "Your Supabase session has expired. Sign in again.");
      }

      const response = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberId: memberToRemove.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not remove the member.");
      }

      setMembers((prev) => prev.filter((member) => member.id !== memberToRemove.id));
      setMemberToRemove(null);
      setModal("members");
      showNotice(`${memberToRemove.full_name} was removed.`);
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : "Could not remove the member.");
    } finally {
      setMemberBusy(false);
    }
  }

  async function submitSemesterEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManageCourseFolders) {
      showNotice("Only admins, superior admins and monitors can edit the current semester.", "error");
      return;
    }

    const next = Number(semesterDraft);
    if (!Number.isInteger(next) || next < 1 || next > 8) {
      showNotice("Pick a semester between 1 and 8.", "error");
      return;
    }

    const previous = semester;
    setSemester(next);
    setSemesterBusy(true);

    try {
      let fallbackMessage = "";

      if (hasAuthenticatedSupabase && supabase && profile) {
        const { error } = await supabase
          .from("department_settings")
          .upsert(
            { key: "current_semester", value: String(next), updated_by: profile.id, updated_at: new Date().toISOString() },
            { onConflict: "key" },
          );

        if (error && !isMissingTableError(error)) {
          setSemester(previous);
          showNotice("Could not save the current semester.", "error");
          return;
        }
        if (error) {
          fallbackMessage = "Supabase is missing public.department_settings. The semester was saved on this device only. Run supabase/department-settings.sql in the SQL Editor.";
        }
      } else if (!hasAuthenticatedSupabase) {
        fallbackMessage = "Sign in with your department account to share the current semester with everyone.";
      }

      setModal(null);
      showNotice(fallbackMessage || `Current semester set to Semester ${next} for the whole department.`, fallbackMessage ? "error" : "neutral");
    } catch (error) {
      setSemester(previous);
      showNotice(error instanceof Error ? error.message : "Could not save the current semester.", "error");
    } finally {
      setSemesterBusy(false);
    }
  }

  async function toggleAssignmentCompletion(assignmentId: string, currentDone: boolean) {
    if (!profile) return;

    const nextDone = !currentDone;
    const apply = (done: boolean) => setCompletions((prev) => {
      const existing = prev.find((c) => c.assignment_id === assignmentId);
      if (existing) {
        return prev.map((c) => (c.assignment_id === assignmentId ? { ...c, done } : c));
      }
      return [...prev, { assignment_id: assignmentId, done }];
    });

    apply(nextDone);

    if (!hasAuthenticatedSupabase || !supabase || !assignmentsBacked) {
      showNotice(nextDone ? "Marked as done (saved on this device)." : "Marked as pending (saved on this device).");
      return;
    }

    try {
      const { error } = await supabase
        .from("assignment_completions")
        .upsert(
          { assignment_id: assignmentId, student_id: profile.id, done: nextDone, updated_at: new Date().toISOString() },
          { onConflict: "assignment_id,student_id" },
        );

      if (error && !isMissingTableError(error)) {
        apply(currentDone);
        showNotice("Could not save your progress.", "error");
        return;
      }

      showNotice(nextDone ? "Marked as done." : "Marked as pending.");
    } catch (error) {
      apply(currentDone);
      showNotice(error instanceof Error ? error.message : "Could not save your progress.", "error");
    }
  }

  async function submitAssignment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canPost) {
      setAssignmentError("Only admins and monitors can add or edit assignments.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const subjectName = String(fd.get("subject") || "").trim();
    const description = String(fd.get("body") || "").trim();
    const dueDate = String(fd.get("due_date") || "").trim();
    const file = fd.get("file") as File | null;

    if (!title || !subjectName || !dueDate) {
      setAssignmentError("Title, subject and due date are required.");
      return;
    }

    if (file && file.size > 0 && !file.name.toLowerCase().endsWith(".pdf")) {
      setAssignmentError("Assignment attachment must be a PDF document.");
      return;
    }

    setAssignmentError("");
    setAssignmentBusy(true);

    try {
      let attachmentUrl = assignmentEditTarget?.attachment_url || null;
      let fileName = assignmentEditTarget?.file_name || null;

      if (file && file.size > 0) {
        const uploaded = await resolveMaterialUrl(file, "assignment");
        attachmentUrl = uploaded.url;
        fileName = uploaded.fileName || file.name;
      }

      let savedAssignment: Assignment | null = null;
      let fallbackMessage = "";
      const baseValues = { title, description, subject: subjectName, due_date: dueDate };
      const valuesWithAttachment = { ...baseValues, attachment_url: attachmentUrl, file_name: fileName };

      if (assignmentEditTarget && hasAuthenticatedSupabase && supabase && assignmentsBacked) {
        let updateRes = await supabase
          .from("assignments")
          .update(valuesWithAttachment)
          .eq("id", assignmentEditTarget.id)
          .select("id, title, description, subject, due_date, created_at, attachment_url, file_name")
          .single();

        if (updateRes.error && (updateRes.error.message?.includes("attachment_url") || updateRes.error.message?.includes("file_name"))) {
          updateRes = await supabase
            .from("assignments")
            .update(baseValues)
            .eq("id", assignmentEditTarget.id)
            .select("id, title, description, subject, due_date, created_at")
            .single();
        }

        if (updateRes.error && !isMissingTableError(updateRes.error)) {
          setAssignmentError(updateRes.error.message || "Could not update the assignment.");
          return;
        }
        if (updateRes.error) {
          fallbackMessage = "Supabase is missing public.assignments. The assignment was updated on this device only.";
        } else if (updateRes.data) {
          savedAssignment = { ...(updateRes.data as Assignment), attachment_url: attachmentUrl, file_name: fileName };
        } else {
          setAssignmentError("Supabase did not return the updated assignment.");
          return;
        }
      } else if (assignmentEditTarget && hasAuthenticatedSupabase && supabase) {
        fallbackMessage = "Assignments are not connected to Supabase. The change was saved on this device only.";
      } else if (!assignmentEditTarget && hasAuthenticatedSupabase && supabase && profile) {
        let insertRes = await supabase
          .from("assignments")
          .insert({ ...valuesWithAttachment, author_id: profile.id })
          .select("id, title, description, subject, due_date, created_at, attachment_url, file_name")
          .single();

        if (insertRes.error && (insertRes.error.message?.includes("attachment_url") || insertRes.error.message?.includes("file_name"))) {
          insertRes = await supabase
            .from("assignments")
            .insert({ ...baseValues, author_id: profile.id })
            .select("id, title, description, subject, due_date, created_at")
            .single();
        }

        if (insertRes.error && !isMissingTableError(insertRes.error)) {
          setAssignmentError(insertRes.error.message || "Could not publish the assignment.");
          return;
        }
        if (insertRes.error) {
          fallbackMessage = "Supabase is missing public.assignments. The assignment was saved locally only.";
        } else if (insertRes.data) {
          savedAssignment = { ...(insertRes.data as Assignment), attachment_url: attachmentUrl, file_name: fileName };
          setAssignmentsBacked(true);
        } else {
          setAssignmentError("Supabase did not return the new assignment.");
          return;
        }
      }

      if (!savedAssignment) {
        savedAssignment = {
          ...(assignmentEditTarget ?? {}),
          id: assignmentEditTarget?.id ?? `a-${Date.now()}`,
          title,
          description,
          subject: subjectName,
          due_date: dueDate,
          attachment_url: attachmentUrl,
          file_name: fileName,
          created_at: assignmentEditTarget?.created_at ?? new Date().toISOString(),
        };
      }

      setAssignments((prev) => assignmentEditTarget
        ? prev.map((assignment) => assignment.id === assignmentEditTarget.id ? savedAssignment! : assignment)
        : [savedAssignment!, ...prev]);
      setAssignmentEditTarget(null);
      setAssignmentError("");
      setModal(null);
      showNotice(fallbackMessage || (assignmentEditTarget ? "Assignment updated." : "Assignment published."), fallbackMessage ? "error" : "neutral");
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : "Could not save the assignment.");
    } finally {
      setAssignmentBusy(false);
      setUploadProgress(null);
    }
  }

  function openEditAssignment(assignment: Assignment) {
    if (!canPost) {
      showNotice("Only admins and monitors can edit assignments.", "error");
      return;
    }
    setAssignmentError("");
    setAssignmentEditTarget(assignment);
    setModal("edit-assignment");
  }

  function openNewAssignment() {
    if (!canPost) {
      showNotice("Only admins and monitors can add assignments.", "error");
      return;
    }
    setAssignmentError("");
    setAssignmentEditTarget(null);
    setModal("assignment");
  }

  function openDeleteAssignment(assignment: Assignment) {
    if (!canPost) {
      showNotice("Only admins and monitors can delete assignments.", "error");
      return;
    }
    setAssignmentError("");
    setAssignmentDeleteTarget(assignment);
    setModal("delete-assignment");
  }

  async function deleteAssignment(assignment: Assignment) {
    if (!canPost) {
      setAssignmentError("Only admins and monitors can delete assignments.");
      return;
    }

    setAssignmentError("");
    setAssignmentBusy(true);
    let fallbackMessage = "";
    try {
      if (hasAuthenticatedSupabase && supabase && assignmentsBacked) {
        const { data, error } = await supabase
          .from("assignments")
          .delete()
          .eq("id", assignment.id)
          .select("id")
          .maybeSingle();

        if (error && !isMissingTableError(error)) {
          setAssignmentError(error.message || "Could not delete the assignment.");
          return;
        }
        if (error) {
          fallbackMessage = "Supabase is missing public.assignments. The assignment was deleted on this device only.";
        }
        if (!error && !data) {
          setAssignmentError("Assignment not found or you do not have permission to delete it.");
          return;
        }
      } else if (hasAuthenticatedSupabase && supabase) {
        fallbackMessage = "Assignments are not connected to Supabase. The assignment was deleted on this device only.";
      }

      setAssignments((prev) => prev.filter((item) => item.id !== assignment.id));
      setCompletions((prev) => prev.filter((item) => item.assignment_id !== assignment.id));
      setAssignmentDeleteTarget(null);
      setModal(null);
      showNotice(fallbackMessage || "Assignment deleted.", fallbackMessage ? "error" : "neutral");
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : "Could not delete the assignment.");
    } finally {
      setAssignmentBusy(false);
    }
  }

  async function renameSubjectFolder(currentName: string, nextName: string): Promise<boolean> {
    if (!canManageCourseFolders) {
      showNotice("Only admins and monitors can edit subject folders.", "error");
      return false;
    }

    const cleanedName = nextName.trim().replace(/\s+/g, " ");
    if (!cleanedName) {
      showNotice("Course name cannot be empty.", "error");
      return false;
    }

    if (cleanedName === currentName) {
      return true;
    }

    const duplicate = (subjectFolders[semester] ?? []).some((name) => name.toLowerCase() === cleanedName.toLowerCase() && name !== currentName);
    if (duplicate) {
      showNotice(`The course "${cleanedName}" already exists for Semester ${semester}.`, "error");
      return false;
    }

    setNotice("");
    setNoticeTone("neutral");
    setCourseMutationBusy(true);
    try {
      if (configured && supabase && profile) {
        const client = supabase;
        const { data: updatedFolders, error: folderError } = await client
          .from("course_folders")
          .update({ name: cleanedName })
          .eq("semester", semester)
          .eq("name", currentName)
          .select("id");

        if (folderError && !isMissingTableError(folderError)) {
          showNotice("Could not update the shared course name.", "error");
          return false;
        }

        if (!updatedFolders?.length && !folderError) {
          const { error: folderInsertError } = await client
            .from("course_folders")
            .upsert({ semester, name: cleanedName }, { onConflict: "semester,name" });

          if (folderInsertError && !isMissingTableError(folderInsertError)) {
            showNotice("Could not save the renamed course folder.", "error");
            return false;
          }
        }

        const { error: materialsError } = await client
          .from("materials")
          .update({ subject: cleanedName })
          .eq("semester", semester)
          .eq("subject", currentName);

        if (materialsError && !isMissingTableError(materialsError)) {
          showNotice("Could not update the course materials.", "error");
          return false;
        }

        const { error: syllabusError } = await client
          .from("course_syllabi")
          .update({ subject: cleanedName, updated_at: new Date().toISOString() })
          .eq("semester", semester)
          .eq("subject", currentName);

        if (syllabusError && !isMissingTableError(syllabusError)) {
          showNotice("Could not update the course syllabus.", "error");
          return false;
        }
      }

      if (hasAuthenticatedSupabase) {
        const response = await fetch("/api/materials", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: await getStaffAuthorizationHeader(),
          },
          body: JSON.stringify({ semester, currentSubject: currentName, nextSubject: cleanedName }),
        });

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          showNotice(result?.error || "Could not save the renamed course materials.", "error");
          return false;
        }
      }
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not update the course name.", "error");
      return false;
    } finally {
      setCourseMutationBusy(false);
    }

    setSubjectFolders((prev) => ({
      ...prev,
      [semester]: (prev[semester] ?? []).map((name) => (name === currentName ? cleanedName : name)),
    }));

    setMaterials((prev) => prev.map((material) => {
      if (material.semester === semester && material.subject === currentName) {
        return {
          ...material,
          subject: cleanedName,
          course_name: cleanedName,
        };
      }
      return material;
    }));
    setCourseSyllabi((prev) => prev.map((syllabus) => (
      syllabus.semester === semester && syllabus.subject === currentName
        ? { ...syllabus, subject: cleanedName, updated_at: new Date().toISOString() }
        : syllabus
    )));

    setActiveSubjectFolder(cleanedName);
    setActiveCourseSubFolder(null);
    setSubject(cleanedName);
    if (currentName !== cleanedName) {
      setNotice(`Course "${currentName}" was renamed to "${cleanedName}".`);
    }
    return true;
  }

  async function deleteSubjectFolder(subjectName: string): Promise<boolean> {
    if (!canManageCourseFolders) {
      showNotice("Only admins and monitors can delete subject folders.", "error");
      return false;
    }

    setNotice("");
    setNoticeTone("neutral");
    setCourseMutationBusy(true);
    try {
      if (configured && supabase && profile) {
        const client = supabase;
        const { error: folderError } = await client
          .from("course_folders")
          .delete()
          .eq("semester", semester)
          .eq("name", subjectName);

        if (folderError && !isMissingTableError(folderError)) {
          showNotice("Could not delete the shared course folder.", "error");
          return false;
        }

        const { error: materialsError } = await client
          .from("materials")
          .delete()
          .eq("semester", semester)
          .eq("subject", subjectName);

        if (materialsError && !isMissingTableError(materialsError)) {
          showNotice("Could not delete the course materials.", "error");
          return false;
        }

        const { error: syllabusError } = await client
          .from("course_syllabi")
          .delete()
          .eq("semester", semester)
          .eq("subject", subjectName);

        if (syllabusError && !isMissingTableError(syllabusError)) {
          showNotice("Could not delete the course syllabus.", "error");
          return false;
        }
      }

      if (hasAuthenticatedSupabase) {
        const params = new URLSearchParams({ semester: String(semester), subject: subjectName });
        const response = await fetch(`/api/materials?${params.toString()}`, {
          method: "DELETE",
          headers: { Authorization: await getStaffAuthorizationHeader() },
        });

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          showNotice(result?.error || "Could not remove the course from saved materials.", "error");
          return false;
        }
      }
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not delete the course folder.", "error");
      return false;
    } finally {
      setCourseMutationBusy(false);
    }

    setSubjectFolders((prev) => ({
      ...prev,
      [semester]: (prev[semester] ?? []).filter((name) => name !== subjectName),
    }));

    setMaterials((prev) => prev.filter((material) => !(material.semester === semester && material.subject === subjectName)));
    setCourseSyllabi((prev) => prev.filter((syllabus) => !(syllabus.semester === semester && syllabus.subject === subjectName)));
    setActiveSubjectFolder(null);
    setActiveCourseSubFolder(null);
    setSubject("All subjects");
    setNotice(`Course "${subjectName}" and its materials were deleted.`);
    return true;
  }

  async function saveCourseFolder(courseSemester: number, courseName: string): Promise<boolean> {
    if (!configured || !supabase || !profile) {
      return true;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        showNotice("Your session has expired. Sign in again to continue.", "error");
        setModal("login");
        return false;
      }

      const { error } = await supabase
        .from("course_folders")
        .upsert({ semester: courseSemester, name: courseName }, { onConflict: "semester,name" });

      if (error && !isMissingTableError(error)) {
        const authFailure = /jwt|expired|invalid|row-level|permission|401|403/i.test(error.message || "");
        showNotice(
          authFailure
            ? "Your session has expired. Sign in again to continue."
            : "Could not save the course to the shared department list.",
          "error"
        );
        if (authFailure) setModal("login");
        return false;
      }

      return true;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not save the course folder.", "error");
      return false;
    }
  }

  function openNewAnnouncement() {
    if (!canPost) {
      showNotice("Only admins and monitors can publish announcements.", "error");
      return;
    }

    setAnnouncementError("");
    setAnnouncementEditTarget(null);
    setAnnouncementDeleteTarget(null);
    setModal("announcement");
  }

  function openEditAnnouncement(item: Announcement) {
    if (!canPost) {
      showNotice("Only admins and monitors can edit announcements.", "error");
      return;
    }

    setAnnouncementError("");
    setAnnouncementEditTarget(item);
    setAnnouncementDeleteTarget(null);
    setModal("edit-announcement");
  }

  function openDeleteAnnouncement(item: Announcement) {
    if (!canPost) {
      showNotice("Only admins and monitors can delete announcements.", "error");
      return;
    }

    setAnnouncementError("");
    setAnnouncementEditTarget(null);
    setAnnouncementDeleteTarget(item);
    setModal("delete-announcement");
  }

  async function handleAnnouncementSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canPost) {
      setAnnouncementError("Only admins and monitors can publish or edit announcements.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const body = String(formData.get("body") || "").trim();
    const important = formData.get("important") === "on";

    if (!title || !body) {
      setAnnouncementError("Announcement title and details are required.");
      return;
    }

    setAnnouncementError("");
    setAnnouncementBusy(true);
    let localFallback = !hasAuthenticatedSupabase || !supabase || !profile;
    let fallbackMessage = "";

    try {
      let savedAnnouncement: Announcement | null = null;
      if (!localFallback && supabase && profile) {
        const values = { title, body, important };

        if (announcementEditTarget) {
          const { data, error } = await supabase
            .from("announcements")
            .update(values)
            .eq("id", announcementEditTarget.id)
            .select("id, title, body, important, created_at")
            .maybeSingle();

          if (error && !isMissingTableError(error)) {
            setAnnouncementError(error.message || "Could not update the announcement.");
            return;
          }
          if (error) {
            localFallback = true;
            fallbackMessage = "Supabase is missing public.announcements. Changes were saved locally only. Run supabase/announcements.sql in the SQL Editor.";
          } else if (data) {
            savedAnnouncement = data as Announcement;
          } else {
            setAnnouncementError("This announcement no longer exists. Refresh the list and try again.");
            return;
          }
        } else {
          const { data, error } = await supabase
            .from("announcements")
            .insert({ ...values, author_id: profile.id })
            .select("id, title, body, important, created_at")
            .single();

          if (error && !isMissingTableError(error)) {
            setAnnouncementError(error.message || "Could not publish the announcement.");
            return;
          }
          if (error) {
            localFallback = true;
            fallbackMessage = "Supabase is missing public.announcements. The announcement was saved locally only. Run supabase/announcements.sql in the SQL Editor.";
          } else if (data) {
            savedAnnouncement = data as Announcement;
          } else {
            setAnnouncementError("Supabase did not return the saved announcement.");
            return;
          }
        }
      }

      if (localFallback) {
        const existing = announcementEditTarget;
        savedAnnouncement = {
          id: existing?.id ?? `a-${Date.now()}`,
          title,
          body,
          important,
          created_at: existing?.created_at ?? new Date().toISOString(),
        };
      }

      if (!savedAnnouncement) {
        setAnnouncementError("Could not save the announcement.");
        return;
      }

      setAnnouncements((prev) => announcementEditTarget
        ? prev.map((item) => item.id === announcementEditTarget.id ? savedAnnouncement! : item)
        : [savedAnnouncement!, ...prev]);
      setModal(null);
      setAnnouncementEditTarget(null);
      setAnnouncementError("");
      showNotice(fallbackMessage || (announcementEditTarget ? "Announcement updated." : "Announcement published."), fallbackMessage ? "error" : "neutral");
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : "Could not save the announcement.");
    } finally {
      setAnnouncementBusy(false);
    }
  }

  async function deleteAnnouncement(item: Announcement): Promise<boolean> {
    if (!canPost) {
      setAnnouncementError("Only admins and monitors can delete announcements.");
      return false;
    }

    setAnnouncementError("");
    setAnnouncementBusy(true);
    let localFallback = !hasAuthenticatedSupabase || !supabase;
    let fallbackMessage = "";

    try {
      if (!localFallback && supabase) {
        const { error } = await supabase
          .from("announcements")
          .delete()
          .eq("id", item.id);

        if (error && !isMissingTableError(error)) {
          setAnnouncementError(error.message || "Could not delete the announcement.");
          return false;
        }
        if (error) {
          localFallback = true;
          fallbackMessage = "Supabase is missing public.announcements. The announcement was deleted locally only. Run supabase/announcements.sql in the SQL Editor.";
        }
      }

      setAnnouncements((prev) => prev.filter((announcement) => announcement.id !== item.id));
      setModal(null);
      setAnnouncementDeleteTarget(null);
      showNotice(fallbackMessage || "Announcement deleted.", fallbackMessage ? "error" : "neutral");
      return true;
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : "Could not delete the announcement.");
      return false;
    } finally {
      setAnnouncementBusy(false);
    }
  }

  async function submitAddSubject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cleanedName = String(fd.get("subject") || "").trim().replace(/\s+/g, " ");

    if (!cleanedName) {
      setNotice("Subject name cannot be empty.");
      return;
    }

    const duplicate = semesterSubjectFolders.some((name) => name.toLowerCase() === cleanedName.toLowerCase());
    if (duplicate) {
      setNotice(`The subject "${cleanedName}" already exists for Semester ${semester}.`);
      return;
    }

    if (!(await saveCourseFolder(semester, cleanedName))) return;

    setSubjectFolders((prev) => ({
      ...prev,
      [semester]: [...(prev[semester] ?? []), cleanedName],
    }));
    setActiveSubjectFolder(cleanedName);
    setActiveCourseSubFolder(null);
    setSubject(cleanedName);
    setModal(null);
    setNotice(`Subject "${cleanedName}" was added to Semester ${semester}.`);
  }

  async function submitPyqCourse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManageMaterials) {
      setPyqError("Only admins and monitors can add PYQ courses.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("course") || "").trim().replace(/\s+/g, " ");
    if (!name) {
      setPyqError("Enter a course name.");
      return;
    }
    if (pyqCourses.some((course) => course.semester === pyqSemester && course.name.toLowerCase() === name.toLowerCase())) {
      setPyqError(`The course "${name}" already exists in Semester ${pyqSemester}.`);
      return;
    }
    if (hasAuthenticatedSupabase && pyqError) {
      return;
    }

    setPyqBusy(true);
    setPyqError("");
    try {
      let savedCourse: PyqCourse;
      if (hasAuthenticatedSupabase && supabase) {
        const { data, error } = await supabase
          .from("pyq_course_folders")
          .insert({ semester: pyqSemester, name })
          .select("id, semester, name")
          .single();

        if (error) {
          setPyqError(isMissingTableError(error)
            ? "PYQ tables are missing from the connected Supabase project. Run the full supabase/pyqs.sql script in that project's SQL Editor, then refresh."
            : isMissingColumnError(error)
              ? pyqSchemaUpdateMessage
              : error.code === "42501"
                ? "Supabase denied PYQ course creation. Run the latest supabase/pyqs.sql script and, for the Superior Admin account, supabase/fixed_admin.sql in the SQL Editor. Ensure the signed-in profile has an admin or monitor role."
              : error.message || "Could not add the PYQ course.");
          return;
        }
        savedCourse = data as PyqCourse;
      } else {
        savedCourse = { id: `pyq-course-${Date.now()}`, semester: pyqSemester, name };
      }

      setPyqCourses((prev) => [...prev, savedCourse]);
      setActivePyqCourseId(savedCourse.id);
      setModal(null);
      showNotice(`${name} added to Semester ${pyqSemester}.`);
    } catch (error) {
      setPyqError(error instanceof Error ? error.message : "Could not add the PYQ course.");
    } finally {
      setPyqBusy(false);
    }
  }

  async function submitPyqCourseEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManageMaterials || !pyqCourseEditTarget) {
      setPyqError("Only admins and monitors can edit PYQ courses.");
      return;
    }

    const name = pyqCourseDraft.trim().replace(/\s+/g, " ");
    if (!name) {
      setPyqError("Enter a course name.");
      return;
    }
    if (pyqCourses.some((course) =>
      course.id !== pyqCourseEditTarget.id &&
      course.semester === pyqCourseEditTarget.semester &&
      course.name.toLowerCase() === name.toLowerCase()
    )) {
      setPyqError(`The course "${name}" already exists in Semester ${pyqCourseEditTarget.semester}.`);
      return;
    }

    setPyqBusy(true);
    setPyqError("");
    try {
      let updatedCourse: PyqCourse = { ...pyqCourseEditTarget, name };
      if (hasAuthenticatedSupabase && supabase) {
        const { data, error } = await supabase
          .from("pyq_course_folders")
          .update({ name })
          .eq("id", pyqCourseEditTarget.id)
          .select("id, semester, name")
          .single();
        if (error) {
          setPyqError(error.message || "Could not update the PYQ course.");
          return;
        }
        updatedCourse = data as PyqCourse;
      }

      setPyqCourses((prev) => prev.map((course) => course.id === updatedCourse.id ? updatedCourse : course));
      setPyqCourseEditTarget(null);
      setPyqCourseDraft("");
      setModal(null);
      showNotice(`PYQ course renamed to "${name}".`);
    } catch (error) {
      setPyqError(error instanceof Error ? error.message : "Could not update the PYQ course.");
    } finally {
      setPyqBusy(false);
    }
  }

  async function deletePyqCourse(course: PyqCourse) {
    if (!canManageMaterials) {
      setPyqError("Only admins and monitors can delete PYQ courses.");
      return;
    }

    setPyqBusy(true);
    setPyqError("");
    try {
      if (hasAuthenticatedSupabase && supabase) {
        const { data, error } = await supabase
          .from("pyq_course_folders")
          .delete()
          .eq("id", course.id)
          .select("id")
          .maybeSingle();
        if (error) {
          setPyqError(error.message || "Could not delete the PYQ course.");
          return;
        }
        if (!data) {
          setPyqError("Course not found or you do not have permission to delete it.");
          return;
        }
      }

      setPyqCourses((prev) => prev.filter((item) => item.id !== course.id));
      setPyqFiles((prev) => prev.filter((file) => file.course_id !== course.id));
      setActivePyqCourseId((current) => current === course.id ? null : current);
      setActivePyqExamType(null);
      setPyqCourseDeleteTarget(null);
      setModal(null);
      showNotice(`PYQ course "${course.name}" and its files were deleted.`);
    } catch (error) {
      setPyqError(error instanceof Error ? error.message : "Could not delete the PYQ course.");
    } finally {
      setPyqBusy(false);
    }
  }

  async function submitPyqFileEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManageMaterials || !pyqFileEditTarget) {
      setPyqError("Only admins and monitors can edit PYQ files.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const selectedFile = formData.get("file");
    const replacementFile = selectedFile instanceof File && selectedFile.size > 0 ? selectedFile : null;
    if (!title) {
      setPyqError("Enter a title for this PYQ file.");
      return;
    }
    if (replacementFile) {
      const extension = replacementFile.name.slice(replacementFile.name.lastIndexOf(".")).toLowerCase();
      if (!allowedPyqExtensions.some((allowed) => allowed === extension)) {
        setPyqError("Choose a PDF, Office document, text file, or supported image.");
        return;
      }
      if (replacementFile.size > 104857600) {
        setPyqError("File is too large. Maximum allowed size is 100 MB.");
        return;
      }
    }

    setPyqBusy(true);
    setPyqError("");
    try {
      const updates: { title: string; file_name?: string; url?: string } = { title };
      if (replacementFile) {
        const uploaded = await resolveMaterialUrl(replacementFile);
        updates.file_name = uploaded.fileName;
        updates.url = uploaded.url;
      }

      let updatedFile: PyqFile = { ...pyqFileEditTarget, ...updates };
      if (hasAuthenticatedSupabase && supabase) {
        const { data, error } = await supabase
          .from("pyq_materials")
          .update(updates)
          .eq("id", pyqFileEditTarget.id)
          .select("id, course_id, exam_type, title, file_name, url, created_at, uploader_id")
          .single();
        if (error) {
          setPyqError(error.message || "Could not update the PYQ file.");
          return;
        }
        updatedFile = data as PyqFile;
      }

      setPyqFiles((prev) => prev.map((file) => file.id === updatedFile.id ? updatedFile : file));
      setPyqFileEditTarget(null);
      setModal(null);
      showNotice("PYQ file updated.");
    } catch (error) {
      setUploadProgress(null);
      setPyqError(error instanceof Error ? error.message : "Could not update the PYQ file.");
    } finally {
      setPyqBusy(false);
    }
  }

  async function deletePyqFile(file: PyqFile) {
    if (!canManageMaterials) {
      setPyqError("Only admins and monitors can delete PYQ files.");
      return;
    }

    setPyqBusy(true);
    setPyqError("");
    try {
      if (hasAuthenticatedSupabase && supabase) {
        const { data, error } = await supabase
          .from("pyq_materials")
          .delete()
          .eq("id", file.id)
          .select("id")
          .maybeSingle();
        if (error) {
          setPyqError(error.message || "Could not delete the PYQ file.");
          return;
        }
        if (!data) {
          setPyqError("PYQ file not found or you do not have permission to delete it.");
          return;
        }
      }

      setPyqFiles((prev) => prev.filter((item) => item.id !== file.id));
      setPyqFileDeleteTarget(null);
      setModal(null);
      showNotice(`PYQ file "${file.title}" was deleted.`);
    } catch (error) {
      setPyqError(error instanceof Error ? error.message : "Could not delete the PYQ file.");
    } finally {
      setPyqBusy(false);
    }
  }

  async function submitPyqFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManageMaterials) {
      setPyqError("Only admins and monitors can share PYQ files.");
      return;
    }
    const course = pyqCourses.find((item) => item.id === activePyqCourseId);
    if (!course) {
      setPyqError("Select a course before sharing a PYQ file.");
      return;
    }
    if (!activePyqExamType) {
      setPyqError("Select Mid-Sem or End-Sem before sharing a PYQ file.");
      return;
    }
    if (hasAuthenticatedSupabase && pyqError) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setPyqError("Choose a file to share.");
      return;
    }
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedPyqExtensions.some((allowed) => allowed === extension)) {
      setPyqError("Choose a PDF, Office document, text file, or supported image.");
      return;
    }
    if (!title) {
      setPyqError("Enter a title for this PYQ file.");
      return;
    }
    if (file.size > 104857600) {
      setPyqError("File is too large. Maximum allowed size is 100 MB.");
      return;
    }

    setPyqBusy(true);
    setPyqError("");
    try {
      const uploaded = await resolveMaterialUrl(file);
      let savedFile: PyqFile;
      if (hasAuthenticatedSupabase && supabase && profile) {
        const { data, error } = await supabase
          .from("pyq_materials")
          .insert({
            course_id: course.id,
            exam_type: activePyqExamType,
            title,
            file_name: uploaded.fileName,
            url: uploaded.url,
            uploader_id: profile.id,
          })
          .select("id, course_id, exam_type, title, file_name, url, created_at, uploader_id")
          .single();

        if (error) {
          setPyqError(isMissingTableError(error)
            ? "PYQ tables are missing from the connected Supabase project. Run the full supabase/pyqs.sql script in that project's SQL Editor, then refresh."
            : isMissingColumnError(error)
              ? pyqSchemaUpdateMessage
              : error.message || "Could not save the PYQ file.");
          return;
        }
        savedFile = data as PyqFile;
      } else {
        savedFile = {
          id: `pyq-file-${Date.now()}`,
          course_id: course.id,
          exam_type: activePyqExamType,
          title,
          file_name: uploaded.fileName,
          url: uploaded.url,
          created_at: new Date().toISOString(),
          uploader_id: profile?.id || "preview-admin",
        };
      }

      setPyqFiles((prev) => [savedFile, ...prev]);
      setModal(null);
      showNotice("PYQ file shared successfully.");
    } catch (error) {
      setUploadProgress(null);
      setPyqError(error instanceof Error ? error.message : "Could not upload the PYQ file.");
    } finally {
      setPyqBusy(false);
    }
  }

  function openShareMaterialForSubject(subjectName: string) {
    if (!canManageMaterials) {
      setNotice("Only admins and monitors can manage course materials.");
      return;
    }

    // Pre-select the resource type that matches the sub-folder being shared from.
    setMaterialKindPreset(
      activeCourseSubFolder === "Youtube Lectures Link" || activeCourseSubFolder === "E-Books"
        ? "link"
        : activeCourseSubFolder === "Notes"
          ? "file"
          : null
    );
    // E-Books folder is links-only: the modal locks kind and category when this preset is set.
    setMaterialCategoryPreset(activeCourseSubFolder === "E-Books" ? "E-Book" : null);
    setMaterialSubjectPreset(subjectName);
    setSubject(subjectName);
    setModal("material");
  }

  function openSyllabusEditor() {
    if (!canManageMaterials || !activeSubjectFolder) {
      showNotice("Only admins and monitors can manage course syllabi.", "error");
      return;
    }

    const existing = courseSyllabi.find((syllabus) => (
      syllabus.semester === semester && syllabus.subject === activeSubjectFolder
    )) ?? null;
    setSyllabusEditTarget(existing);
    setSyllabusError("");
    setModal("syllabus");
  }

  async function submitSyllabus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManageMaterials || !activeSubjectFolder) {
      setSyllabusError("Only admins and monitors can manage course syllabi.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setSyllabusError("Choose a PDF syllabus file.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream")) {
      setSyllabusError("Syllabus files must be PDF documents.");
      return;
    }
    if (file.size > 104857600) {
      setSyllabusError("File is too large. Maximum allowed size is 100 MB.");
      return;
    }

    setSyllabusBusy(true);
    setSyllabusError("");
    try {
      const uploaded = await resolveMaterialUrl(file, "syllabus");
      const values = {
        semester,
        subject: activeSubjectFolder,
        file_name: uploaded.fileName,
        url: uploaded.url,
        uploader_id: profile?.id || "preview-admin",
        updated_at: new Date().toISOString(),
      };

      let savedSyllabus: CourseSyllabus;
      if (hasAuthenticatedSupabase && supabase && profile) {
        const { data, error } = await supabase
          .from("course_syllabi")
          .upsert(values, { onConflict: "semester,subject" })
          .select("id, semester, subject, file_name, url, uploader_id, updated_at")
          .single();

        if (error) {
          setSyllabusError(isMissingTableError(error)
            ? "Syllabus storage is not set up in Supabase. Run supabase/course_syllabi.sql in the SQL Editor."
            : error.message || "Could not save the syllabus PDF.");
          return;
        }
        savedSyllabus = data as CourseSyllabus;
      } else {
        savedSyllabus = {
          id: syllabusEditTarget?.id ?? `syllabus-${semester}-${Date.now()}`,
          ...values,
          updated_at: new Date().toISOString(),
        };
      }

      setCourseSyllabi((previous) => [
        ...previous.filter((syllabus) => !(
          syllabus.semester === savedSyllabus.semester && syllabus.subject === savedSyllabus.subject
        )),
        savedSyllabus,
      ]);
      setSyllabusEditTarget(null);
      setModal(null);
      showNotice(syllabusEditTarget ? "Syllabus PDF replaced." : "Syllabus PDF added.");
    } catch (error) {
      setUploadProgress(null);
      setSyllabusError(error instanceof Error ? error.message : "Could not upload the syllabus PDF.");
    } finally {
      setSyllabusBusy(false);
    }
  }

  async function deleteSyllabus(syllabus: CourseSyllabus) {
    if (!canManageMaterials) {
      setSyllabusError("Only admins and monitors can delete course syllabi.");
      return;
    }

    setSyllabusBusy(true);
    setSyllabusError("");
    try {
      if (hasAuthenticatedSupabase && supabase) {
        const { data, error } = await supabase
          .from("course_syllabi")
          .delete()
          .eq("id", syllabus.id)
          .select("id")
          .maybeSingle();

        if (error) {
          setSyllabusError(error.message || "Could not delete the syllabus PDF.");
          return;
        }
        if (!data) {
          setSyllabusError("Syllabus not found or you do not have permission to delete it.");
          return;
        }
      }

      setCourseSyllabi((previous) => previous.filter((item) => item.id !== syllabus.id));
      setSyllabusDeleteTarget(null);
      setModal(null);
      showNotice(`Syllabus for ${syllabus.subject} was deleted.`);
    } catch (error) {
      setSyllabusError(error instanceof Error ? error.message : "Could not delete the syllabus PDF.");
    } finally {
      setSyllabusBusy(false);
    }
  }

  async function handleMaterialSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManageMaterials) {
      setNotice("Only admins and monitors can manage course materials.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const subject = String(fd.get("subject") || materialSubjectPreset || "").trim().replace(/\s+/g, " ");
    const ebookMode = materialCategoryPreset === "E-Book";
    const category = String(fd.get("category") || (ebookMode ? "E-Book" : "Class Link")) as ResourceCategory;
    const kind = ebookMode ? "link" : String(fd.get("kind") || "file");
    const url = String(fd.get("url") || "").trim();
    const semesterValue = Number(fd.get("semester") || semester);
    const uploadedFile = fd.get("file") instanceof File ? fd.get("file") as File : null;

    if (!title || !subject) {
      setNotice("Subject and title are required for department materials.");
      return;
    }

    if (ebookMode && !url) {
      setNotice("E-Books are links-only. Paste the e-book URL before sharing.");
      return;
    }

    if (!(await saveCourseFolder(semesterValue, subject))) return;

    let finalUrl = url || "#";
    let finalFileName = uploadedFile?.name || "";

    if (uploadedFile && uploadedFile.size > 0) {
      setBusy(true);
      try {
        const uploadResult = await resolveMaterialUrl(uploadedFile);
        finalUrl = uploadResult.url || finalUrl;
        finalFileName = uploadResult.fileName || finalFileName;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save the uploaded file.";
        showNotice(message, "error");
        setUploadProgress(null);
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    const newItem: Material = {
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `m-${Date.now()}`,
      title,
      course_name: subject,
      semester: semesterValue,
      subject,
      category,
      kind: kind === "link" ? "link" : "file",
      url: finalUrl,
      file_name: finalFileName,
      created_at: new Date().toISOString(),
      uploader_id: profile?.email || "preview-admin",
    };

    if (hasAuthenticatedSupabase) {
      try {
        const response = await fetch("/api/materials", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: await getStaffAuthorizationHeader(),
          },
          body: JSON.stringify(newItem),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || "Could not save the shared material.");
        }
        if (result?.material?.id) {
          newItem.id = result.material.id;
        }
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "Could not save the shared material.", "error");
        return;
      }
    }

    const nextSubjectList = subjectFolders[semesterValue] ?? [];
    if (!nextSubjectList.includes(subject)) {
      setSubjectFolders((prev) => ({
        ...prev,
        [semesterValue]: [...nextSubjectList, subject],
      }));
    }

    setMaterials((prev) => [newItem, ...prev]);
    setModal(null);
    setMaterialSubjectPreset(null);
    showNotice("Course material shared successfully! All users can now access and download it.", "neutral");

  }

  function getDownloadUrl(m: Material): string {
    if (m.kind === "link") return m.url;
    if (m.url.startsWith("data:")) return m.url;

    let downloadName = m.file_name || m.title || "document";
    if (!downloadName.includes(".")) {
      if (m.url.toLowerCase().includes(".pdf") || m.title.toLowerCase().includes("pdf")) {
        downloadName += ".pdf";
      } else if (m.url.toLowerCase().includes(".docx") || m.title.toLowerCase().includes("docx")) {
        downloadName += ".docx";
      } else if (m.url.toLowerCase().includes(".pptx") || m.title.toLowerCase().includes("pptx")) {
        downloadName += ".pptx";
      } else if (m.url.toLowerCase().includes(".xlsx") || m.title.toLowerCase().includes("xlsx")) {
        downloadName += ".xlsx";
      } else {
        downloadName += ".pdf";
      }
    }

    return `/api/download?url=${encodeURIComponent(m.url)}&name=${encodeURIComponent(downloadName)}`;
  }

  function getPyqDownloadUrl(file: PyqFile): string {
    const filename = file.file_name || file.title || "document";
    return `/api/download?url=${encodeURIComponent(file.url)}&name=${encodeURIComponent(filename)}`;
  }

  function openDeleteMaterial(material: Material) {
    if (!canManageMaterials) {
      showNotice("Only admins and monitors can delete materials.", "error");
      return;
    }
    setMaterialDeleteTarget(material);
    setModal("delete-material");
  }

  async function handleDeleteMaterial(id: string): Promise<boolean> {
    if (!canManageMaterials) {
      showNotice("Only admins and monitors can delete materials.", "error");
      return false;
    }

    setMaterialDeleteBusy(true);
    try {
      if (hasAuthenticatedSupabase) {
        const response = await fetch(`/api/materials?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Authorization: await getStaffAuthorizationHeader() },
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || "Could not remove the material.");
        }
      }

      setMaterials((prev) => prev.filter((m) => m.id !== id));
      setMaterialDeleteTarget(null);
      setModal(null);
      setNotice("Course material removed.");
      return true;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not remove the material.", "error");
      return false;
    } finally {
      setMaterialDeleteBusy(false);
    }
  }

  async function signOut() {
    if (configured && supabase) {
      await supabase.auth.signOut();
    }
    setProfile(null);
    setModal("login");
    setSection("Overview");
  }

  async function submitPasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;

    const fd = new FormData(e.currentTarget);
    const currentPassword = String(fd.get("current_password") || "");
    const newPassword = String(fd.get("new_password") || "");
    const confirmPassword = String(fd.get("confirm_password") || "");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setPasswordBusy(true);
    setPasswordError("");

    try {
      // Preview / local accounts: update the locally stored password.
      if (profile.id.endsWith("-preview") || !hasAuthenticatedSupabase) {
        const emailKey = profile.email.trim().toLowerCase();
        setDemoPasswords((prev) => ({ ...prev, [emailKey]: newPassword }));
        setModal(null);
        showNotice("Password updated on this device.", "neutral");
        return;
      }

      if (!supabase) {
        setPasswordError("Supabase authentication is unavailable. Please try again.");
        return;
      }

      // Real accounts: verify the current password first, then update it.
      const email = profile.email.trim();
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verifyError) {
        setPasswordError("Your current password is incorrect.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message || "Could not update the password. Try again.");
        return;
      }

      setModal(null);
      showNotice("Password changed successfully. Use the new password next time you sign in.", "neutral");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not update the password. Try again.");
    } finally {
      setPasswordBusy(false);
    }
  }

  function openEditCourseFolder(subjectName: string) {
    if (!canManageCourseFolders) {
      showNotice("Only admins and monitors can edit course names.", "error");
      return;
    }
    setNotice("");
    setNoticeTone("neutral");
    setSubjectEditTarget(subjectName);
    setSubjectDraft(subjectName);
    setModal("edit-course");
  }

  function openDeleteCourseFolder(subjectName: string) {
    if (!canManageCourseFolders) {
      showNotice("Only admins and monitors can delete course folders.", "error");
      return;
    }
    setNotice("");
    setNoticeTone("neutral");
    setSubjectDeleteTarget(subjectName);
    setModal("delete-course");
  }

  if (!profile) {
    const authMode = modal ?? "login";

    if (!isSessionReady) {
      return (
        <main className={`app-shell auth-gate-shell ${themeMode === "dark" ? "theme-dark" : ""}`}>
          <div className="photo-bg" />
          <div className="photo-overlay" />
          <ElectricalBackground />
          <div className="modal-backdrop auth-gate-backdrop">
            <div className="modal auth-gate-modal">
              <div className="modal-head">
                <div>
                  <span className="eyebrow">{"IIEST EE'30"}</span>
                  <h2>Loading your session…</h2>
                </div>
              </div>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className={`app-shell auth-gate-shell ${themeMode === "dark" ? "theme-dark" : ""}`}>
        <div className="photo-bg" />
        <div className="photo-overlay" />
        <ElectricalBackground />
        <div className="modal-backdrop auth-gate-backdrop">
          <div className="modal auth-gate-modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">{"IIEST EE'30"}</span>
                <h2>{authMode === "login" ? "Welcome back" : authMode === "signup" ? "Create your account" : "Reset password"}</h2>
              </div>
            </div>

            {notice && (
              <div className={`modal-notice ${noticeTone === "error" ? "error" : ""}`}>{notice}</div>
            )}

            <form className="form-stack" onSubmit={(e) => authSubmit(e, authMode === "signup" ? "signup" : authMode === "forgot" ? "forgot" : "login")}>
              {(authMode === "login" || authMode === "signup") && (
                <>
                  <button type="button" className="google-btn" onClick={signInWithGoogle} disabled={busy || googleBusy}>
                    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{googleBusy ? "Opening Google…" : "Continue with Google"}</span>
                  </button>
                  <div className="auth-divider"><span>or use your college email</span></div>
                </>
              )}

              {authMode === "signup" && (
                <Field label="Full name">
                  <input name="name" required placeholder="Your name" />
                </Field>
              )}

              {authMode === "forgot" && Boolean(resetToken && resetEmailTarget) ? (
                <Field label="Reset for">
                  <input name="email" type="email" readOnly value={resetEmailTarget || ""} />
                </Field>
              ) : (
                <Field label="College email">
                  <input name="email" type="email" required autoComplete="email" placeholder="Enter Your G-Suite Id" />
                </Field>
              )}

              {authMode !== "forgot" && (
                <Field label="Password">
                  <div className="password-input-wrap">
                    <input
                      className="password-input"
                      name="password"
                      type={showAuthPassword ? "text" : "password"}
                      minLength={8}
                      required
                      placeholder={authMode === "login" ? "Enter Your Password" : "At least 8 characters"}
                    />
                    <button
                      type="button"
                      className="password-visibility-btn"
                      aria-label={showAuthPassword ? "Hide password" : "Show password"}
                      title={showAuthPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowAuthPassword((visible) => !visible)}
                    >
                      {showAuthPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </Field>
              )}

              {authMode === "forgot" && Boolean(resetToken && resetEmailTarget) && (
                <Field label="New password">
                  <input name="new_password" type="password" minLength={8} required placeholder="Create a new password" />
                </Field>
              )}

              <button className="primary-btn full-btn" type="submit" disabled={busy}>
                {busy ? "Please wait…" : authMode === "forgot" && Boolean(resetToken && resetEmailTarget) ? "Update password" : authMode === "forgot" ? "Send reset link" : authMode === "login" ? "Sign in" : "Create account"}
              </button>

              {authMode === "forgot" && (
                <p className="form-switch">
                  <button type="button" onClick={() => {
                    setResetToken(null);
                    setResetEmailTarget(null);
                    setShowAuthPassword(false);
                    setModal("login");
                  }}>
                    Back to Login Page
                  </button>
                </p>
              )}

              {authMode !== "forgot" && (
                <p className="form-switch">
                  {authMode === "login" ? "New to IIEST EE'30?" : "Already registered?"}{" "}
                  <button type="button" onClick={() => { setShowAuthPassword(false); setModal(authMode === "login" ? "signup" : "login"); }}>
                    {authMode === "login" ? "Create an account" : "Sign in"}
                  </button>
                </p>
              )}

              {authMode === "login" && (
                <p className="form-switch">
                  <button type="button" onClick={() => {
                    setResetToken(null);
                    setResetEmailTarget(null);
                    setShowAuthPassword(false);
                    setModal("forgot");
                  }}>
                    Forgot password?
                  </button>
                </p>
              )}

              <p className="auth-credit">
                Made by Raihan <span className="footer-heart">✳</span> · Idea By Ambar
              </p>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`app-shell ${themeMode === "dark" ? "theme-dark" : ""}`}>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <GraduationCap size={21} />
          </div>
          <div>
            <b>
              {"IIEST EE'30"}
            </b>
            <small>ELECTRICAL ENGINEERING, CLASS OF 2030</small>
          </div>
          <button className="icon-btn mobile-close" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={`nav-item ${section === n.name ? "active" : ""}`}
              onClick={() => {
                setSection(n.name);
                setMobileNav(false);
              }}
            >
              <n.icon size={18} />
              {n.name}
              {n.name === "Announcements" && unreadAnnouncementCount > 0 && <i>{unreadAnnouncementCount}</i>}
              {n.name === "Assignments" && unreadAssignmentCount > 0 && <i>{unreadAssignmentCount}</i>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="semester-mini">
            <div className="mini-icon">
              <BookOpen size={17} />
            </div>
            <div>
              <b>Current semester</b>
              <small>Semester {semester}</small>
            </div>
            {canManageCourseFolders && (
              <button
                className="semester-edit-btn"
                title="Edit current semester (admins, superior admin and monitors only)"
                onClick={() => {
                  setSemesterDraft(semester);
                  setModal("edit-semester");
                }}
              >
                <Pencil size={13} />
              </button>
            )}
          </div>

          <button className="nav-item" onClick={() => setSection("Help & guide")}>
            <CircleHelp size={18} />
            Help & guide
          </button>

          {isAdmin && (
            <button className="nav-item" onClick={() => { setMemberError(""); setMembersLoading(hasAuthenticatedSupabase); setModal("members"); }}>
              <Users size={18} />
              Manage members
            </button>
          )}

          <div className="profile-mini">
            <div className="avatar">{profile?.full_name?.[0]?.toUpperCase() || "G"}</div>
            <div className="profile-info">
              <b>{profile?.full_name || "Guest student"}</b>
              <small>{getRoleLabel(profile?.email, profile?.role)}</small>
            </div>
            {profile ? (
              <button className="icon-btn" onClick={signOut} title="Sign out">
                <LogOut size={16} />
              </button>
            ) : (
              <button className="text-btn" onClick={() => setModal("login")}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button className="icon-btn menu-btn" onClick={() => setMobileNav(true)}>
              <Menu size={20} />
            </button>
            <div className="crumb">
              Department <span>/</span> <b>{section}</b>
            </div>
          </div>

          <div className="top-actions">
            <div className="theme-toggle" role="group" aria-label="Site color mode">
              <button
                type="button"
                className={themeMode === "normal" ? "selected" : ""}
                aria-label="Normal mode"
                aria-pressed={themeMode === "normal"}
                title="Normal mode"
                onClick={() => setThemeMode("normal")}
              >
                <span className="theme-toggle-icon" aria-hidden="true">☀️</span>
              </button>
              <button
                type="button"
                className={themeMode === "dark" ? "selected" : ""}
                aria-label="Dark mode"
                aria-pressed={themeMode === "dark"}
                title="Dark mode"
                onClick={() => setThemeMode("dark")}
              >
                <span className="theme-toggle-icon" aria-hidden="true">🌙</span>
              </button>
            </div>
            <span className="secure-pill">
              <span /> Private department space
            </span>
            <button className="icon-btn notification-btn" onClick={() => setSection("Announcements")}>
              <Bell size={18} />
              {unreadAnnouncementCount > 0 && <i />}
            </button>

            {profile && (
              <div className="profile-menu-wrap">
                <button className="top-avatar" onClick={() => setProfileMenuOpen((prev) => !prev)} title="Profile">
                  {profile?.full_name?.[0]?.toUpperCase() || "G"}
                </button>

                {profileMenuOpen && (
                  <div className="profile-dropdown">
                    <div className="profile-dropdown-user">
                      <div className="avatar">{profile?.full_name?.[0]?.toUpperCase() || "G"}</div>
                      <div>
                        <b>{profile.full_name}</b>
                        <small>{getRoleLabel(profile.email, profile.role)}</small>
                      </div>
                    </div>
                    <button type="button" className="profile-action" onClick={() => {
                      setProfileMenuOpen(false);
                      setPasswordError("");
                      setModal("change-password");
                    }}>
                      Change password
                    </button>
                    <button type="button" className="profile-action danger" onClick={() => {
                      setProfileMenuOpen(false);
                      signOut();
                    }}>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="content">
          {!configured && (
            <div className="setup-banner">
              <Sparkles size={18} />
              <div>
                <b>Preview mode is active</b>
                <span>
                  Explore the interface with sample content. Connect Supabase to enable real accounts, uploads and private progress.
                </span>
              </div>
              <a href="#setup">Setup guide <ArrowUpRight size={14} /></a>
            </div>
          )}

          {notice && (
            <div className={`toast ${noticeTone === "error" ? "error" : ""}`}>
              <span>{notice}</span>
              <button onClick={() => { setNotice(""); setNoticeTone("neutral"); }}>
                <X size={15} />
              </button>
            </div>
          )}

          {section === "Overview" && (
            <>
              <div className="welcome-row overview-hero">
                <div>
                  <h1>
                    Electrical Engineering<br />
                    <em>Department '30</em>
                  </h1>
                  <p className="welcome-quote">
                    “If you want to find the secrets of the universe, think in terms of energy, frequency and vibration.”
                    <span>— <i>Nikola Tesla</i></span>
                  </p>
                </div>
                <div className="welcome-current-widget" aria-label="Current local date and time">
                  <div className="welcome-current-icon"><Clock3 size={18} /></div>
                  <div className="welcome-current-info">
                    <span><i aria-hidden="true" /> LOCAL TIME</span>
                    <b>{currentTime ? currentTime.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "--:--"}</b>
                    <small>{currentTime ? currentTime.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "Updating date…"}</small>
                  </div>
                </div>
              </div>

              <div className="stats-grid overview-stats">
                <Stat icon={<FileText />} label="Study resources" value={materials.length.toString()} note="Notes & lecture links" />
                <Stat icon={<Bell />} label="Announcements" value={announcements.length.toString()} note="Department updates" />
                <Stat icon={<Clock3 />} label="Upcoming tasks" value={upcoming.length.toString()} note={`${overdue.length} overdue`} />
                <Stat icon={<CheckCircle2 />} label="Completed" value={completedCount.toString()} note="Your personal progress" />
              </div>

              <div className="section-heading">
                <div>
                  <span className="eyebrow">STAY IN THE LOOP</span>
                  <h2>Latest updates</h2>
                </div>
                <button className="subtle-link" onClick={() => setSection("Announcements")}>
                  All announcements <ArrowUpRight size={15} />
                </button>
              </div>

              <div className="announcement-list">
                {announcements.slice(0, 2).map((a) => (
                  <AnnouncementCard key={a.id} item={a} canManage={canPost} onEdit={() => openEditAnnouncement(a)} onDelete={() => openDeleteAnnouncement(a)} />
                ))}
              </div>

              <div className="section-heading task-heading">
                <div>
                  <span className="eyebrow">KEEP MOVING FORWARD</span>
                  <h2>On your plate</h2>
                </div>
                <button className="subtle-link" onClick={() => setSection("Assignments")}>
                  View tracker <ArrowUpRight size={15} />
                </button>
              </div>

              <div className="task-preview">
                {pending.slice(0, 3).map((a) => (
                  <TaskRow key={a.id} item={a} done={false} onToggle={() => toggleAssignmentCompletion(a.id, false)} />
                ))}
              </div>
            </>
          )}

          {section === "Study materials" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR LEARNING LIBRARY</span>
                  <h1>Study materials</h1>
                  <p>Course resources by semester, with class links and notes managed by admins and monitors.</p>
                </div>
              </div>
              {syllabusError && <div className="modal-notice error" role="alert">{syllabusError}</div>}

              {activeSubjectFolder ? (
                <div className="subject-detail-panel">
                  <div className="subject-detail-header">
                    <div>
                      <span className="eyebrow">SEMESTER {semester} · {activeCourseSubFolder ? activeSubjectFolder : "COURSE FOLDER"}</span>
                      <h2>{activeCourseSubFolder ?? activeSubjectFolder}</h2>
                    </div>
                    <div className="pyq-course-actions">
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() => {
                          if (activeCourseSubFolder) {
                            setActiveCourseSubFolder(null);
                          } else {
                            setActiveSubjectFolder(null);
                            setActiveCourseSubFolder(null);
                          }
                        }}
                      >
                        <ArrowLeft size={15} /> {activeCourseSubFolder ? "Back to folders" : "Back to courses"}
                      </button>
                      {activeCourseSubFolder && activeCourseSubFolder !== "Syllabus" && canManageMaterials && (
                        <button className="primary-btn" type="button" onClick={() => openShareMaterialForSubject(activeSubjectFolder)}>
                          <Plus size={15} /> Share material
                        </button>
                      )}
                    </div>
                  </div>

                  {activeCourseSubFolder ? (
                    activeCourseSubFolder === "Syllabus" ? (
                      (() => {
                        const syllabus = courseSyllabi.find((item) => item.semester === semester && item.subject === activeSubjectFolder);
                        return syllabus ? (
                          <div className="material-grid">
                            <div className="material-card">
                              <div className="material-icon"><FileText /></div>
                              <div className="material-meta">
                                <span>{activeSubjectFolder}</span>
                                <span>SYLLABUS · PDF</span>
                              </div>
                              <h3>{syllabus.file_name}</h3>
                              <p>Course syllabus document</p>
                              <div className="material-footer">
                                <span>SEM {syllabus.semester}</span>
                                <a
                                  href={`/api/download?url=${encodeURIComponent(syllabus.url)}&name=${encodeURIComponent(syllabus.file_name)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                >
                                  Download PDF <Download size={14} />
                                </a>
                              </div>
                              {canManageMaterials && (
                                <div className="syllabus-actions">
                                  <button type="button" className="secondary-btn" disabled={syllabusBusy} onClick={openSyllabusEditor}>
                                    <Pencil size={14} /> Edit PDF
                                  </button>
                                  <button type="button" className="secondary-btn danger" disabled={syllabusBusy} onClick={() => { setSyllabusDeleteTarget(syllabus); setSyllabusError(""); setModal("delete-syllabus"); }}>
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="syllabus-empty">
                            <Empty
                              icon={<FileText />}
                              title="No syllabus PDF yet"
                              text={canManageMaterials ? "Add the syllabus PDF for this course. You can replace or delete it later." : "The course syllabus will appear here when shared."}
                            />
                            {canManageMaterials && (
                              <button type="button" className="primary-btn" disabled={syllabusBusy} onClick={openSyllabusEditor}>
                                <Plus size={15} /> Add syllabus PDF
                              </button>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                    (() => {
                      const subFolderItems = visibleMaterials.filter((m) => (
                        activeCourseSubFolder === "Youtube Lectures Link"
                          ? m.kind === "link" && m.category !== "E-Book"
                          : activeCourseSubFolder === "E-Books"
                            ? m.kind === "link" && m.category === "E-Book"
                            : m.kind !== "link"
                      ));
                      const searchQuery = courseSubFolderSearch.trim().toLowerCase();
                      const matchedMaterials = searchQuery
                        ? subFolderItems.filter((m) => [m.title, m.category, m.file_name].some((value) => (value || "").toLowerCase().includes(searchQuery)))
                        : subFolderItems;
                      return (
                      <>
                        <div className="filter-row subject-search-row">
                          <div className="search-box">
                            <Search size={17} />
                            <input
                              placeholder={activeCourseSubFolder === "Youtube Lectures Link" ? "Search lecture links..." : activeCourseSubFolder === "E-Books" ? "Search e-books..." : "Search notes..."}
                              value={courseSubFolderSearch}
                              onChange={(e) => setCourseSubFolderSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="material-grid">
                          {matchedMaterials.map((m) => (
                            <div className="material-card" key={m.id}>
                              <div className={`material-icon ${m.kind === "link" ? "video-icon" : ""}`}>
                                {m.kind === "link" ? (m.category === "E-Book" ? <BookOpen /> : <Video />) : <FileText />}
                              </div>
                              <div className="material-meta">
                                <span>{m.course_name || m.subject}</span>
                                <span>{m.category}</span>
                              </div>
                              <h3>{m.title}</h3>
                              <p>{m.category === "E-Book" ? "E-Book · Online link" : m.kind === "link" ? "Class Link · YouTube / NPTEL" : `${m.category} · Shared department document`}</p>
                              <div className="material-footer">
                                <span>SEM {m.semester}</span>
                                {m.kind === "link" ? (
                                  <a href={m.url} target="_blank" rel="noreferrer">
                                    Open resource <ArrowUpRight size={14} />
                                  </a>
                                ) : (
                                  <a
                                    href={getDownloadUrl(m)}
                                    target="_blank"
                                    rel="noreferrer"
                                    download
                                  >
                                    Download <Download size={14} />
                                  </a>
                                )}
                                {canManageMaterials && (
                                  <button className="icon-btn danger" onClick={() => openDeleteMaterial(m)} title="Remove" aria-label={`Delete material: ${m.title}`}>
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {matchedMaterials.length === 0 && (
                          subFolderItems.length === 0 ? (
                            <Empty
                              icon={activeCourseSubFolder === "Notes" ? <FileText /> : activeCourseSubFolder === "E-Books" ? <BookOpen /> : <Video />}
                              title={activeCourseSubFolder === "Notes" ? "No notes here yet" : activeCourseSubFolder === "E-Books" ? "No e-books here yet" : "No lecture links here yet"}
                              text={
                                activeCourseSubFolder === "E-Books"
                                  ? canManageMaterials
                                    ? "Use Share material to add the first e-book link to this folder."
                                    : "E-book links will appear here once shared."
                                  : canManageMaterials
                                    ? "Use Share material to add the first resource to this folder."
                                    : "Notes and lecture links will appear here once shared."
                              }
                            />
                          ) : (
                            <Empty
                              icon={<Search />}
                              title="No matching results"
                              text={`Nothing in this folder matches "${courseSubFolderSearch.trim()}". Try a different search term.`}
                            />
                          )
                        )}
                      </>
                      );
                    })()
                    )
                  ) : (
                    <div className="subject-folder-grid">
                      {(["Notes", "Youtube Lectures Link", "E-Books", "Syllabus"] as const).map((subFolder) => {
                        const count = subFolder === "Syllabus"
                          ? courseSyllabi.some((item) => item.semester === semester && item.subject === activeSubjectFolder) ? 1 : 0
                          : visibleMaterials.filter((m) => (
                              subFolder === "Youtube Lectures Link"
                                ? m.kind === "link" && m.category !== "E-Book"
                                : subFolder === "E-Books"
                                  ? m.kind === "link" && m.category === "E-Book"
                                  : m.kind !== "link"
                            )).length;
                        return (
                          <div
                            className="subject-folder-card"
                            key={subFolder}
                            onClick={() => setActiveCourseSubFolder(subFolder)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setActiveCourseSubFolder(subFolder);
                              }
                            }}
                          >
                            <div className="subject-folder-head">
                              <div className="subject-folder-icon">{subFolder === "Notes" ? "N" : subFolder === "Syllabus" ? "S" : subFolder === "E-Books" ? "E" : "Y"}</div>
                              <div>
                                <strong>{subFolder}</strong>
                                <small>{subFolder === "Syllabus" ? (count ? "1 PDF" : "No PDF") : `${count} item${count === 1 ? "" : "s"}`}</small>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="filter-panel">
                    <div className="semester-tabs">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <button key={n} className={semester === n ? "selected" : ""} onClick={() => { setSemester(n); setSubject("All subjects"); setActiveSubjectFolder(null); setActiveCourseSubFolder(null); }}>
                          Sem {n}
                        </button>
                      ))}
                    </div>

                    <div className="filter-row">
                      <div className="search-box">
                        <Search size={18} />
                        <input placeholder="Search notes or lectures..." value={query} onChange={(e) => setQuery(e.target.value)} />
                      </div>
                      {canManageCourseFolders && (
                        <button className="secondary-btn" type="button" onClick={handleAddSubject}>
                          <Plus size={15} /> Add subject
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="subject-folder-grid">
                    {filteredSemesterFolders.length === 0 ? (
                      <Empty
                        icon={<BookOpen />}
                        title={query ? "No matching courses" : "No subject folders yet"}
                        text={query ? "Try a different search term or clear the search bar." : "Add the first subject for this semester to begin sharing notes and links."}
                      />
                    ) : (
                      filteredSemesterFolders.map((folderName) => {
                        const folderMaterials = materials.filter((material) => material.semester === semester && material.subject === folderName);
                        return (
                          <div
                            className="subject-folder-card"
                            key={folderName}
                            onClick={() => { setActiveSubjectFolder(folderName); setActiveCourseSubFolder(null); }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setActiveSubjectFolder(folderName);
                                setActiveCourseSubFolder(null);
                              }
                            }}
                          >
                            <div className="subject-folder-head">
                              <div className="subject-folder-icon">{folderName.charAt(0).toUpperCase()}</div>
                              <div>
                                <strong>{folderName}</strong>
                                <small>{folderMaterials.length} resource{folderMaterials.length === 1 ? "" : "s"}</small>
                              </div>
                            </div>

                            {canManageCourseFolders && (
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={() => openEditCourseFolder(folderName)}
                                  style={{ padding: "7px 10px", fontSize: 11 }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={() => openDeleteCourseFolder(folderName)}
                                  style={{ padding: "7px 10px", fontSize: 11, borderColor: "#f6d7d7", color: "#ae2a2a" }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {section === "PYQs" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">PAST EXAM PAPERS</span>
                  <h1>PYQs</h1>
                  <p>Browse previous year questions by semester and course.</p>
                </div>
                {canManageMaterials && (
                  <button className="primary-btn" type="button" onClick={openAddPyqCourse} disabled={pyqsLoading || pyqBusy}>
                    <Plus size={17} /> Add course
                  </button>
                )}
              </div>

              {pyqError && <div className="modal-notice error" role="alert">{pyqError}</div>}

              <div className="filter-panel">
                <div className="semester-tabs">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      className={pyqSemester === n ? "selected" : ""}
                      onClick={() => { setPyqSemester(n); setActivePyqCourseId(null); setActivePyqExamType(null); }}
                    >
                      Sem {n}
                    </button>
                  ))}
                </div>
              </div>

              {pyqsLoading ? (
                <Empty icon={<FolderOpen />} title="Loading PYQs" text="Getting the course folders and files ready." />
              ) : activePyqCourse ? (
                <div className="subject-detail-panel">
                  <div className="subject-detail-header">
                    <div>
                      <span className="eyebrow">SEMESTER {activePyqCourse.semester} · {activePyqExamType ? activePyqCourse.name : "PYQ COURSE"}</span>
                      <h2>{activePyqExamType ?? activePyqCourse.name}</h2>
                    </div>
                    <div className="pyq-course-actions">
                      <button className="secondary-btn" type="button" onClick={() => {
                        if (activePyqExamType) setActivePyqExamType(null);
                        else setActivePyqCourseId(null);
                      }}>
                        {activePyqExamType ? "Back to folders" : "Back to courses"}
                      </button>
                      {canManageMaterials && activePyqExamType && (
                        <button className="primary-btn" type="button" onClick={openSharePyqFile} disabled={pyqBusy}>
                          <Plus size={15} /> Share material
                        </button>
                      )}
                    </div>
                  </div>

                  {activePyqExamType ? (
                    <>
                      <div className="material-grid">
                        {visiblePyqFiles.map((file) => (
                          <div className="material-card" key={file.id}>
                            <div className="material-icon"><FileText /></div>
                            <div className="material-meta">
                              <span>{activePyqCourse.name}</span>
                              <span>{activePyqExamType}</span>
                            </div>
                            <h3>{file.title}</h3>
                            <p>{file.file_name}</p>
                            <div className="material-footer">
                              <span>SEM {activePyqCourse.semester}</span>
                              <a href={getPyqDownloadUrl(file)} download={file.file_name}>
                                Download <Download size={14} />
                              </a>
                              {canManageMaterials && (
                                <div className="pyq-file-actions">
                                  <button type="button" className="icon-btn" onClick={() => openEditPyqFile(file)} aria-label={`Edit PYQ file: ${file.title}`} title="Edit file">
                                    <Pencil size={15} />
                                  </button>
                                  <button type="button" className="icon-btn danger" onClick={() => openDeletePyqFile(file)} aria-label={`Delete PYQ file: ${file.title}`} title="Delete file">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {visiblePyqFiles.length === 0 && (
                        <Empty icon={<FileText />} title={`No ${activePyqExamType} files yet`} text="Admins and monitors can share files in this folder." />
                      )}
                    </>
                  ) : (
                    <div className="subject-folder-grid">
                      {(["Mid-Sem", "End-Sem"] as const).map((examType) => {
                        const count = pyqFiles.filter((file) => file.course_id === activePyqCourse.id && (file.exam_type ?? "End-Sem") === examType).length;
                        return (
                          <div
                            className="subject-folder-card"
                            key={examType}
                            onClick={() => setActivePyqExamType(examType)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setActivePyqExamType(examType);
                              }
                            }}
                          >
                            <div className="subject-folder-head">
                              <div className="subject-folder-icon">{examType === "Mid-Sem" ? "M" : "E"}</div>
                              <div>
                                <strong>{examType}</strong>
                                <small>{count} file{count === 1 ? "" : "s"}</small>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="subject-folder-grid">
                  {visiblePyqCourses.length === 0 ? (
                    <Empty icon={<FolderOpen />} title="No courses in this semester" text={canManageMaterials ? "Add a course to start organizing previous year question papers." : "Course folders will appear here when the department adds them."} />
                  ) : (
                    visiblePyqCourses.map((course) => {
                      const count = pyqFiles.filter((file) => file.course_id === course.id).length;
                      return (
                        <div
                          className="subject-folder-card"
                          key={course.id}
                          onClick={() => { setActivePyqCourseId(course.id); setActivePyqExamType(null); }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setActivePyqCourseId(course.id);
                              setActivePyqExamType(null);
                            }
                          }}
                        >
                          <div className="subject-folder-head">
                            <div className="subject-folder-icon">{course.name.charAt(0).toUpperCase()}</div>
                            <div>
                              <strong>{course.name}</strong>
                              <small>{count} file{count === 1 ? "" : "s"}</small>
                            </div>
                          </div>
                          {canManageMaterials && (
                            <div className="subject-folder-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                              <button type="button" className="secondary-btn" onClick={() => openEditPyqCourse(course)}>
                                Edit
                              </button>
                              <button type="button" className="secondary-btn danger" onClick={() => openDeletePyqCourse(course)}>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}

          {section === "Announcements" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">THE DEPARTMENT BULLETIN</span>
                  <h1>Announcements</h1>
                  <p>Important dates, notices and updates from your department.</p>
                </div>
                {canPost && (
                  <button className="primary-btn" onClick={openNewAnnouncement}>
                    <Plus size={17} /> New announcement
                  </button>
                )}
              </div>

              <div className="announcement-list full-list">
                {announcements.map((a) => (
                  <AnnouncementCard key={a.id} item={a} canManage={canPost} onEdit={() => openEditAnnouncement(a)} onDelete={() => openDeleteAnnouncement(a)} />
                ))}
              </div>

              {announcements.length === 0 && (
                <Empty icon={<Bell />} title="All quiet for now" text="New department updates will appear here." />
              )}
            </>
          )}

          {section === "Assignments" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR PERSONAL CHECKLIST</span>
                  <h1>Assignment tracker</h1>
                  <p>One list for every deadline. Your completion status is private.</p>
                </div>
                {canPost && (
                  <button className="primary-btn" onClick={openNewAssignment}>
                    <Plus size={17} /> Add assignment
                  </button>
                )}
              </div>

              <div className="assignment-summary">
                <div>
                  <span>TO DO</span>
                  <b>{pending.length}</b>
                </div>
                <div>
                  <span>UPCOMING</span>
                  <b>{upcoming.length}</b>
                </div>
                <div>
                  <span>OVERDUE</span>
                  <b className="overdue-text">{overdue.length}</b>
                </div>
                <div>
                  <span>COMPLETED</span>
                  <b>{completedCount}</b>
                </div>
              </div>

              <div className="assignment-list">
                {assignments.map((a) => {
                  const done = !!completions.find((c) => c.assignment_id === a.id)?.done;
                  return (
                    <TaskRow
                      key={a.id}
                      item={a}
                      done={done}
                      canManage={canPost}
                      onToggle={() => toggleAssignmentCompletion(a.id, done)}
                      onEdit={() => openEditAssignment(a)}
                      onDelete={() => openDeleteAssignment(a)}
                    />
                  );
                })}
              </div>
            </>
          )}

          {section === "Help & guide" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">A QUICK TOUR</span>
                  <h1>Help & guide</h1>
                  <p>A few pointers to make the hub useful from day one.</p>
                </div>
              </div>

              <div className="guide-grid">
                <Guide icon={<BookOpen />} title="Find your resources" text="Choose a semester, filter by subject, then open or download the notes and lecture links you need." />
                <Guide icon={<UploadCloud />} title="Share with classmates" text="Upload a PDF or add a YouTube / NPTEL link. Add the right semester and subject so others can find it." />
                <Guide icon={<Bell />} title="Keep up with notices" text="Check announcements for department updates. Important notices are highlighted at the top." />
                <Guide icon={<CheckCircle2 />} title="Track your work" text="Mark an assignment complete when you finish it. Your status is visible only to your account." />
                <Guide icon={<ShieldCheck />} title="Access & safety" text="Use your approved college email. Monitors can moderate shared material; admins manage member roles." />
                <Guide icon={<Users />} title="Need access?" text="If your department email is not accepted, contact your department administrator to confirm the approved domain." />
              </div>
            </>
          )}
        </div>

        <footer className="footer">
          <span>© 2026 {"IIEST EE'30"}</span>
          <span>
            Made by Raihan <span className="footer-heart">✳</span> · Idea By Ambar
          </span>
        </footer>
      </section>

      {modal && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setModal(null); setMaterialSubjectPreset(null); setMaterialDeleteTarget(null); setSubjectEditTarget(null); setSubjectDeleteTarget(null); setSubjectDraft(""); setPyqCourseEditTarget(null); setPyqCourseDeleteTarget(null); setPyqCourseDraft(""); setPyqFileEditTarget(null); setPyqFileDeleteTarget(null); setAnnouncementEditTarget(null); setAnnouncementDeleteTarget(null); setAnnouncementError(""); setAssignmentEditTarget(null); setAssignmentDeleteTarget(null); setAssignmentError(""); setMemberToRemove(null); setMemberError(""); setNotice(""); } }}>
          <div className="modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">{"IIEST EE'30"}</span>
                <h2>{modal === "login" ? "Welcome back" : modal === "signup" ? "Create your account" : modal === "forgot" ? "Reset password" : modal === "material" ? "Share a resource" : modal === "delete-material" ? "Delete material" : modal === "syllabus" ? (syllabusEditTarget ? "Edit syllabus PDF" : "Add syllabus PDF") : modal === "delete-syllabus" ? "Delete syllabus PDF" : modal === "pyq-course" ? "Add PYQ course" : modal === "pyq-share" ? "Share a PYQ file" : modal === "pyq-edit-course" ? "Edit PYQ course" : modal === "pyq-delete-course" ? "Delete PYQ course" : modal === "pyq-edit-file" ? "Edit PYQ file" : modal === "pyq-delete-file" ? "Delete PYQ file" : modal === "subject" ? "Add subject" : modal === "edit-course" ? "Edit course" : modal === "delete-course" ? "Delete course" : modal === "edit-semester" ? "Edit current semester" : modal === "change-password" ? "Change password" : modal === "announcement" ? "Post an announcement" : modal === "edit-announcement" ? "Edit announcement" : modal === "delete-announcement" ? "Delete announcement" : modal === "assignment" ? "Add an assignment" : modal === "edit-assignment" ? "Edit assignment" : modal === "delete-assignment" ? "Delete assignment" : modal === "remove-member" ? "Remove member" : "Department members"}</h2>
              </div>
              <button className="icon-btn" onClick={() => { setModal(null); setMaterialSubjectPreset(null); setMaterialDeleteTarget(null); setSubjectEditTarget(null); setSubjectDeleteTarget(null); setSubjectDraft(""); setPyqCourseEditTarget(null); setPyqCourseDeleteTarget(null); setPyqCourseDraft(""); setPyqFileEditTarget(null); setPyqFileDeleteTarget(null); setAnnouncementEditTarget(null); setAnnouncementDeleteTarget(null); setAnnouncementError(""); setAssignmentEditTarget(null); setAssignmentDeleteTarget(null); setAssignmentError(""); setMemberToRemove(null); setMemberError(""); }}>
                <X />
              </button>
            </div>

            {modal === "edit-course" && subjectEditTarget && (
              <form className="form-stack subject-form" onSubmit={async (e) => {
                e.preventDefault();
                const saved = await renameSubjectFolder(subjectEditTarget, subjectDraft);
                if (!saved) return;
                setModal(null);
                setSubjectEditTarget(null);
                setSubjectDraft("");
              }}>
                <div className="subject-editor-hero">
                  <div className="subject-modal-icon">✎</div>
                  <div>
                    <span className="eyebrow">EDIT COURSE NAME</span>
                    <h3>Update this folder title</h3>
                  </div>
                </div>
                {notice && noticeTone === "error" && <div className="modal-notice error" role="alert">{notice}</div>}
                <Field label="Course name">
                  <input name="courseName" value={subjectDraft} onChange={(e) => setSubjectDraft(e.target.value)} required autoFocus disabled={courseMutationBusy} />
                </Field>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={courseMutationBusy} onClick={() => { setModal(null); setSubjectEditTarget(null); setSubjectDraft(""); }}>Cancel</button>
                  <button className="primary-btn" type="submit" disabled={courseMutationBusy}>{courseMutationBusy ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            )}

            {modal === "delete-course" && subjectDeleteTarget && (
              <div className="form-stack subject-form">
                <div className="subject-delete-hero">
                  <div className="subject-modal-icon danger">!</div>
                  <div>
                    <span className="eyebrow">DELETE FOLDER</span>
                    <h3>Are You Sure You Want to Delete The Folder?</h3>
                  </div>
                </div>
                {notice && noticeTone === "error" && <div className="modal-notice error" role="alert">{notice}</div>}
                <p className="delete-confirmation-copy">This will remove the course folder “{subjectDeleteTarget}” and any materials saved under it in this semester.</p>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={courseMutationBusy} onClick={() => { setModal(null); setSubjectDeleteTarget(null); }}>Cancel</button>
                  <button type="button" className="primary-btn danger-btn" disabled={courseMutationBusy} onClick={async () => {
                    const deleted = await deleteSubjectFolder(subjectDeleteTarget);
                    if (!deleted) return;
                    setModal(null);
                    setSubjectDeleteTarget(null);
                  }}>{courseMutationBusy ? "Deleting…" : "Delete folder"}</button>
                </div>
              </div>
            )}

            {modal === "delete-material" && materialDeleteTarget && (
              <div className="form-stack subject-form">
                <div className="subject-delete-hero">
                  <div className="subject-modal-icon danger"><Trash2 size={18} /></div>
                  <div>
                    <span className="eyebrow">DELETE MATERIAL</span>
                    <h3>Are You Sure You Want to Delete?</h3>
                  </div>
                </div>
                <p className="delete-confirmation-copy"><strong>{materialDeleteTarget.title}</strong> will be permanently removed from {materialDeleteTarget.subject}.</p>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={materialDeleteBusy} onClick={() => { setModal(null); setMaterialDeleteTarget(null); }}>Cancel</button>
                  <button type="button" className="primary-btn danger-btn" disabled={materialDeleteBusy} onClick={() => { void handleDeleteMaterial(materialDeleteTarget.id); }}>
                    {materialDeleteBusy ? "Deleting…" : "Delete material"}
                  </button>
                </div>
              </div>
            )}

            {modal === "syllabus" && (
              <form className="form-stack" onSubmit={submitSyllabus}>
                {syllabusError && <div className="modal-notice error" role="alert">{syllabusError}</div>}
                <p className="syllabus-course-label">{activeSubjectFolder} · Semester {semester}</p>
                {syllabusEditTarget && <p className="syllabus-current-file">Current PDF: <strong>{syllabusEditTarget.file_name}</strong></p>}
                <Field label={syllabusEditTarget ? "Replacement PDF" : "Syllabus PDF"}>
                  <input
                    type="file"
                    name="file"
                    accept=".pdf,application/pdf"
                    required
                    disabled={syllabusBusy}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file && (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream"))) {
                        setSyllabusError("Syllabus files must be PDF documents.");
                        event.currentTarget.value = "";
                      } else {
                        setSyllabusError("");
                      }
                    }}
                  />
                </Field>
                {uploadProgress && <div className="modal-notice" role="status">{uploadProgress}</div>}
                <button className="primary-btn full-btn" type="submit" disabled={syllabusBusy}>
                  {syllabusBusy ? "Uploading…" : syllabusEditTarget ? "Replace syllabus PDF" : "Upload syllabus PDF"}
                </button>
              </form>
            )}

            {modal === "delete-syllabus" && syllabusDeleteTarget && (
              <div className="form-stack subject-form">
                <div className="subject-delete-hero">
                  <div className="subject-modal-icon danger"><Trash2 size={18} /></div>
                  <div>
                    <span className="eyebrow">DELETE SYLLABUS</span>
                    <h3>Are You Sure You Want to Delete?</h3>
                  </div>
                </div>
                {syllabusError && <div className="modal-notice error" role="alert">{syllabusError}</div>}
                <p className="delete-confirmation-copy"><strong>{syllabusDeleteTarget.file_name}</strong> will be removed from {syllabusDeleteTarget.subject}.</p>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={syllabusBusy} onClick={() => { setModal(null); setSyllabusDeleteTarget(null); }}>Cancel</button>
                  <button type="button" className="primary-btn danger-btn" disabled={syllabusBusy} onClick={() => { void deleteSyllabus(syllabusDeleteTarget); }}>
                    {syllabusBusy ? "Deleting…" : "Delete syllabus"}
                  </button>
                </div>
              </div>
            )}

            {(modal === "login" || modal === "signup" || modal === "forgot") && (
              <form className="form-stack" onSubmit={(e) => authSubmit(e, modal ?? "login")}>
                {modal === "signup" && (
                  <Field label="Full name">
                    <input name="name" required placeholder="Your name" />
                  </Field>
                )}

                {modal === "forgot" && Boolean(resetToken && resetEmailTarget) ? (
                  <Field label="Reset for">
                    <input name="email" type="email" readOnly value={resetEmailTarget || ""} />
                  </Field>
                ) : (
                  <Field label="College email">
                    <input name="email" type="email" required autoComplete="email" placeholder="Enter Your G-Suite Id" />
                  </Field>
                )}

                {modal !== "forgot" && (
                  <Field label="Password">
                    <div className="password-input-wrap">
                      <input
                        className="password-input"
                        name="password"
                        type={showAuthPassword ? "text" : "password"}
                        minLength={8}
                        required
                        placeholder={modal === "login" ? "Enter Your Password" : "At least 8 characters"}
                      />
                      <button
                        type="button"
                        className="password-visibility-btn"
                        aria-label={showAuthPassword ? "Hide password" : "Show password"}
                        title={showAuthPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowAuthPassword((visible) => !visible)}
                      >
                        {showAuthPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </Field>
                )}

                {modal === "forgot" && Boolean(resetToken && resetEmailTarget) && (
                  <Field label="New password">
                    <input name="new_password" type="password" minLength={8} required placeholder="Create a new password" />
                  </Field>
                )}

                <button className="primary-btn full-btn" type="submit" disabled={busy}>
                  {busy ? "Please wait…" : modal === "forgot" && Boolean(resetToken && resetEmailTarget) ? "Update password" : modal === "forgot" ? "Send reset link" : modal === "login" ? "Sign in" : "Create account"}
                </button>

                {modal === "forgot" && (
                  <p className="form-switch">
                    <button type="button" onClick={() => {
                      setResetToken(null);
                      setResetEmailTarget(null);
                      setShowAuthPassword(false);
                      setModal("login");
                    }}>
                      Back to Login Page
                    </button>
                  </p>
                )}

                {modal !== "forgot" && (
                  <p className="form-switch">
                    {modal === "login" ? "New to IIEST EE'30?" : "Already registered?"}{" "}
                    <button type="button" onClick={() => { setShowAuthPassword(false); setModal(modal === "login" ? "signup" : "login"); }}>
                      {modal === "login" ? "Create an account" : "Sign in"}
                    </button>
                  </p>
                )}

                {modal === "login" && (
                  <p className="form-switch">
                    <button type="button" onClick={() => {
                      setResetToken(null);
                      setResetEmailTarget(null);
                      setShowAuthPassword(false);
                      setModal("forgot");
                    }}>
                      Forgot password?
                    </button>
                  </p>
                )}

              </form>
            )}

            {modal === "subject" && (
              <form className="form-stack subject-form" onSubmit={submitAddSubject}>
                <div className="subject-modal-hero">
                  <div className="subject-modal-icon">+</div>
                  <div>
                    <span className="eyebrow">SEMESTER {semester}</span>
                    <h3>Create a new subject folder</h3>
                  </div>
                </div>
                <Field label="Subject name">
                  <input name="subject" required autoFocus placeholder="e.g. Data Structures" />
                </Field>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" onClick={() => setModal(null)}>Cancel</button>
                  <button className="primary-btn" type="submit">Add subject</button>
                </div>
              </form>
            )}

            {modal === "pyq-course" && (
              <form className="form-stack subject-form" onSubmit={submitPyqCourse}>
                <div className="subject-modal-hero">
                  <div className="subject-modal-icon"><FolderOpen size={20} /></div>
                  <div>
                    <span className="eyebrow">SEMESTER {pyqSemester}</span>
                    <h3>Create a PYQ course folder</h3>
                  </div>
                </div>
                {pyqError && <div className="modal-notice error" role="alert">{pyqError}</div>}
                <Field label="Course name">
                  <input name="course" required maxLength={120} placeholder="e.g. Electrical Machines" disabled={pyqBusy} />
                </Field>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={pyqBusy} onClick={() => { setModal(null); setPyqError(""); }}>Cancel</button>
                  <button className="primary-btn" type="submit" disabled={pyqBusy}>{pyqBusy ? "Adding…" : "Add course"}</button>
                </div>
              </form>
            )}

            {modal === "pyq-edit-course" && pyqCourseEditTarget && (
              <form className="form-stack subject-form" onSubmit={submitPyqCourseEdit}>
                <div className="subject-editor-hero">
                  <div className="subject-modal-icon"><Pencil size={18} /></div>
                  <div>
                    <span className="eyebrow">SEMESTER {pyqCourseEditTarget.semester}</span>
                    <h3>Edit PYQ course name</h3>
                  </div>
                </div>
                {pyqError && <div className="modal-notice error" role="alert">{pyqError}</div>}
                <Field label="Course name">
                  <input value={pyqCourseDraft} onChange={(e) => setPyqCourseDraft(e.target.value)} required maxLength={120} disabled={pyqBusy} />
                </Field>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={pyqBusy} onClick={() => { setModal(null); setPyqCourseEditTarget(null); setPyqCourseDraft(""); setPyqError(""); }}>Cancel</button>
                  <button className="primary-btn" type="submit" disabled={pyqBusy}>{pyqBusy ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            )}

            {modal === "pyq-delete-course" && pyqCourseDeleteTarget && (
              <div className="form-stack subject-form">
                <div className="subject-delete-hero">
                  <div className="subject-modal-icon danger"><Trash2 size={18} /></div>
                  <div>
                    <span className="eyebrow">DELETE PYQ COURSE</span>
                    <h3>Are You Sure You Want to Delete?</h3>
                  </div>
                </div>
                {pyqError && <div className="modal-notice error" role="alert">{pyqError}</div>}
                <p className="delete-confirmation-copy"><strong>{pyqCourseDeleteTarget.name}</strong> and all its Mid-Sem and End-Sem files will be permanently deleted.</p>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={pyqBusy} onClick={() => { setModal(null); setPyqCourseDeleteTarget(null); setPyqError(""); }}>Cancel</button>
                  <button type="button" className="primary-btn danger-btn" disabled={pyqBusy} onClick={() => { void deletePyqCourse(pyqCourseDeleteTarget); }}>
                    {pyqBusy ? "Deleting…" : "Delete course"}
                  </button>
                </div>
              </div>
            )}

            {modal === "pyq-share" && activePyqCourse && (
              <form className="form-stack" onSubmit={submitPyqFile}>
                <div className="subject-modal-hero">
                  <div className="subject-modal-icon"><FileText size={20} /></div>
                  <div>
                    <span className="eyebrow">{activePyqExamType} · SEMESTER {activePyqCourse.semester}</span>
                    <h3>{activePyqCourse.name}</h3>
                  </div>
                </div>
                {pyqError && <div className="modal-notice error" role="alert">{pyqError}</div>}
                <Field label="PYQ title">
                  <input name="title" required maxLength={160} placeholder="e.g. End-semester examination 2025" disabled={pyqBusy} />
                </Field>
                <Field label="File (PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, JPG/PNG/WebP; max 100 MB)">
                  <input name="file" type="file" accept={pyqFileAccept} required disabled={pyqBusy} />
                </Field>
                {uploadProgress && <div className="modal-notice">{uploadProgress}</div>}
                <button className="primary-btn full-btn" type="submit" disabled={pyqBusy}>
                  {pyqBusy ? "Uploading…" : "Share PYQ"}
                </button>
              </form>
            )}

            {modal === "pyq-edit-file" && pyqFileEditTarget && (
              <form className="form-stack" onSubmit={submitPyqFileEdit}>
                <div className="subject-modal-hero">
                  <div className="subject-modal-icon"><Pencil size={18} /></div>
                  <div>
                    <span className="eyebrow">{pyqFileEditTarget.exam_type} · EDIT FILE</span>
                    <h3>{pyqCourses.find((course) => course.id === pyqFileEditTarget.course_id)?.name}</h3>
                  </div>
                </div>
                {pyqError && <div className="modal-notice error" role="alert">{pyqError}</div>}
                <Field label="PYQ title">
                  <input name="title" required maxLength={160} defaultValue={pyqFileEditTarget.title} disabled={pyqBusy} />
                </Field>
                <Field label="Replace file (optional; keep empty to retain the current file)">
                  <input name="file" type="file" accept={pyqFileAccept} disabled={pyqBusy} />
                </Field>
                {uploadProgress && <div className="modal-notice">{uploadProgress}</div>}
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={pyqBusy} onClick={() => { setModal(null); setPyqFileEditTarget(null); setPyqError(""); }}>Cancel</button>
                  <button className="primary-btn" type="submit" disabled={pyqBusy}>{pyqBusy ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            )}

            {modal === "pyq-delete-file" && pyqFileDeleteTarget && (
              <div className="form-stack subject-form">
                <div className="subject-delete-hero">
                  <div className="subject-modal-icon danger"><Trash2 size={18} /></div>
                  <div>
                    <span className="eyebrow">DELETE PYQ FILE</span>
                    <h3>Are You Sure You Want to Delete?</h3>
                  </div>
                </div>
                {pyqError && <div className="modal-notice error" role="alert">{pyqError}</div>}
                <p className="delete-confirmation-copy"><strong>{pyqFileDeleteTarget.title}</strong> ({pyqFileDeleteTarget.file_name}) will be permanently removed.</p>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={pyqBusy} onClick={() => { setModal(null); setPyqFileDeleteTarget(null); setPyqError(""); }}>Cancel</button>
                  <button type="button" className="primary-btn danger-btn" disabled={pyqBusy} onClick={() => { void deletePyqFile(pyqFileDeleteTarget); }}>
                    {pyqBusy ? "Deleting…" : "Delete file"}
                  </button>
                </div>
              </div>
            )}

            {modal === "material" && (
              <form className="form-stack" onSubmit={handleMaterialSubmit}>
                <Field label="Resource title">
                  <input name="title" required placeholder="e.g. Unit 3 handwritten notes" />
                </Field>
                <div className="form-two">
                  <Field label="Semester">
                    <select name="semester" defaultValue={semester}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option value={n} key={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Subject">
                    <input name="subject" required defaultValue={materialSubjectPreset ?? ""} placeholder="e.g. Data Structures" />
                  </Field>
                </div>
                <Field label={materialCategoryPreset === "E-Book" ? "Course section (E-Books folder)" : "Course section"}>
                  <select name="category" defaultValue={materialCategoryPreset ?? "Class Link"}>
                    {materialCategoryPreset === "E-Book" ? (
                      <option value="E-Book">E-Book (online link)</option>
                    ) : (
                      <>
                        <option value="Class Link">Classes Link (YouTube / NPTEL)</option>
                        <option value="Digital Notes">Class Notes (Digital)</option>
                        <option value="Handwritten Notes">Class Notes (Handwritten)</option>
                      </>
                    )}
                  </select>
                </Field>
                <Field label={materialCategoryPreset === "E-Book" ? "Resource type (links only)" : "Resource type"}>
                  <select name="kind" defaultValue={materialCategoryPreset === "E-Book" ? "link" : materialKindPreset ?? "file"}>
                    {materialCategoryPreset === "E-Book" ? (
                      <option value="link">Online link (e-book URL)</option>
                    ) : (
                      <>
                        <option value="file">Document (PDF, Word DOCX, PPTX, image)</option>
                        <option value="link">YouTube / NPTEL link</option>
                      </>
                    )}
                  </select>
                </Field>
                {materialCategoryPreset !== "E-Book" && (
                  <Field label="File (PDF, DOCX, DOC, PPTX, XLSX, TXT, Images - max 25 MB)">
                    <input name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*" />
                  </Field>
                )}
                <Field label={materialCategoryPreset === "E-Book" ? "E-book HTTPS link (required)" : "Or paste HTTPS lecture URL"}>
                  <input name="url" type="url" required={materialCategoryPreset === "E-Book"} placeholder="https://…" />
                </Field>
                <button className="primary-btn full-btn" type="submit">
                  Share with department
                </button>
              </form>
            )}

            {modal === "change-password" && (
              <form className="form-stack" onSubmit={submitPasswordChange}>
                <div className="subject-editor-hero">
                  <div className="subject-modal-icon"><Pencil size={18} /></div>
                  <div>
                    <span className="eyebrow">ACCOUNT SECURITY</span>
                    <h3>Change your password</h3>
                  </div>
                </div>
                {passwordError && <div className="modal-notice error" role="alert">{passwordError}</div>}
                <Field label="Current password">
                  <input name="current_password" type="password" required autoComplete="current-password" placeholder="Your current password" disabled={passwordBusy} />
                </Field>
                <Field label="New password (min 8 characters)">
                  <input name="new_password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" disabled={passwordBusy} />
                </Field>
                <Field label="Confirm new password">
                  <input name="confirm_password" type="password" required autoComplete="new-password" placeholder="Repeat the new password" disabled={passwordBusy} />
                </Field>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={passwordBusy} onClick={() => { setModal(null); setPasswordError(""); }}>Cancel</button>
                  <button type="submit" className="primary-btn" disabled={passwordBusy}>{passwordBusy ? "Updating…" : "Update password"}</button>
                </div>
              </form>
            )}

            {(modal === "announcement" || modal === "edit-announcement") && (
              <form className="form-stack" onSubmit={handleAnnouncementSubmit}>
                {announcementError && <div className="modal-notice error" role="alert">{announcementError}</div>}
                <Field label="Title">
                  <input name="title" required maxLength={160} defaultValue={announcementEditTarget?.title ?? ""} placeholder="Give this update a clear title" disabled={announcementBusy} />
                </Field>
                <Field label="Announcement details">
                  <textarea name="body" required rows={4} maxLength={4000} defaultValue={announcementEditTarget?.body ?? ""} placeholder="Add the details students need…" disabled={announcementBusy} />
                </Field>
                <label className="check-field">
                  <input type="checkbox" name="important" defaultChecked={announcementEditTarget?.important ?? false} disabled={announcementBusy} /> Mark as important
                </label>
                <button className="primary-btn full-btn" type="submit" disabled={announcementBusy}>
                  {announcementBusy ? "Saving…" : modal === "edit-announcement" ? "Save changes" : "Publish announcement"}
                </button>
              </form>
            )}

            {modal === "delete-announcement" && announcementDeleteTarget && (
              <div className="form-stack subject-form">
                <div className="subject-delete-hero">
                  <div className="subject-modal-icon danger"><Trash2 size={18} /></div>
                  <div>
                    <span className="eyebrow">DELETE ANNOUNCEMENT</span>
                    <h3>Are you sure you want to delete this announcement?</h3>
                  </div>
                </div>
                {announcementError && <div className="modal-notice error" role="alert">{announcementError}</div>}
                <p className="delete-confirmation-copy"><strong>{announcementDeleteTarget.title}</strong> will be permanently removed.</p>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={announcementBusy} onClick={() => { setModal(null); setAnnouncementDeleteTarget(null); setAnnouncementError(""); }}>Cancel</button>
                  <button type="button" className="primary-btn danger-btn" disabled={announcementBusy} onClick={() => { void deleteAnnouncement(announcementDeleteTarget); }}>
                    {announcementBusy ? "Deleting…" : "Delete announcement"}
                  </button>
                </div>
              </div>
            )}

            {modal === "delete-assignment" && assignmentDeleteTarget && (
              <div className="form-stack subject-form">
                <div className="subject-delete-hero">
                  <div className="subject-modal-icon danger"><Trash2 size={18} /></div>
                  <div>
                    <span className="eyebrow">DELETE ASSIGNMENT</span>
                    <h3>Are you sure you want to delete this assignment?</h3>
                  </div>
                </div>
                {assignmentError && <div className="modal-notice error" role="alert">{assignmentError}</div>}
                <p className="delete-confirmation-copy"><strong>{assignmentDeleteTarget.title}</strong> will be permanently removed.</p>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={assignmentBusy} onClick={() => { setModal(null); setAssignmentDeleteTarget(null); setAssignmentError(""); }}>Cancel</button>
                  <button type="button" className="primary-btn danger-btn" disabled={assignmentBusy} onClick={() => { void deleteAssignment(assignmentDeleteTarget); }}>
                    {assignmentBusy ? "Deleting…" : "Delete assignment"}
                  </button>
                </div>
              </div>
            )}

            {modal === "edit-semester" && (
              <form className="form-stack" onSubmit={submitSemesterEdit}>
                <div className="subject-editor-hero">
                  <div className="subject-modal-icon"><Pencil size={18} /></div>
                  <div>
                    <span className="eyebrow">CURRENT SEMESTER</span>
                    <h3>Set the department's active semester</h3>
                  </div>
                </div>
                <Field label="Semester">
                  <select
                    name="semester"
                    value={semesterDraft}
                    onChange={(e) => setSemesterDraft(Number(e.target.value))}
                    disabled={semesterBusy}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>Semester {n}</option>
                    ))}
                  </select>
                </Field>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={semesterBusy} onClick={() => setModal(null)}>Cancel</button>
                  <button className="primary-btn" type="submit" disabled={semesterBusy}>{semesterBusy ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            )}

            {(modal === "assignment" || modal === "edit-assignment") && (
              <form className="form-stack" onSubmit={submitAssignment}>
                {assignmentError && <div className="modal-notice error" role="alert">{assignmentError}</div>}
                <Field label="Title">
                  <input name="title" required placeholder="Give this assignment a clear title" defaultValue={assignmentEditTarget?.title ?? ""} disabled={assignmentBusy} />
                </Field>
                <Field label="Subject">
                  <input name="subject" required placeholder="e.g. Operating Systems" defaultValue={assignmentEditTarget?.subject ?? ""} disabled={assignmentBusy} />
                </Field>
                <Field label="Assignment description">
                  <textarea name="body" rows={4} placeholder="Optional: add details students need" defaultValue={assignmentEditTarget?.description ?? ""} disabled={assignmentBusy} />
                </Field>
                <Field label="Due date">
                  <input type="date" name="due_date" required defaultValue={assignmentEditTarget?.due_date ?? ""} disabled={assignmentBusy} />
                </Field>
                <Field label={assignmentEditTarget?.attachment_url ? "Replace attachment PDF (optional)" : "Attach assignment PDF (optional)"}>
                  <input name="file" type="file" accept=".pdf,application/pdf" disabled={assignmentBusy} />
                </Field>
                {assignmentEditTarget?.file_name && (
                  <small style={{ color: "var(--muted)", marginTop: -6 }}>
                    Current attachment: <strong>{assignmentEditTarget.file_name}</strong>
                  </small>
                )}
                {uploadProgress && <div className="modal-notice" role="status">{uploadProgress}</div>}
                <button className="primary-btn full-btn" type="submit" disabled={assignmentBusy}>
                  {assignmentBusy ? "Saving…" : assignmentEditTarget ? "Save changes" : "Add assignment"}
                </button>
              </form>
            )}

            {isAdmin && modal === "members" && (
              <div className="members-list">
                {memberError && <div className="modal-notice error" role="alert">{memberError}</div>}
                {membersLoading ? (
                  <p className="member-list-status">Loading members…</p>
                ) : members.length === 0 ? (
                  <p className="member-list-status">No members found.</p>
                ) : members.map((member) => (
                  <div className="member-row" key={member.id}>
                    <div className="avatar">{member.full_name.charAt(0).toUpperCase()}</div>
                    <div className="member-detail">
                      <b>{member.full_name}</b>
                      <small>{member.email}</small>
                    </div>
                    <select
                      value={isProtectedAdmin(member) ? "admin" : member.role}
                      disabled={memberBusy || membersLoading || isProtectedAdmin(member)}
                      title={isProtectedAdmin(member) ? "This account is permanently an admin" : undefined}
                      onChange={(e) => { void changeMemberRole(member, e.target.value as Role); }}
                    >
                      <option value="student">Student</option>
                      <option value="monitor">Class monitor</option>
                      <option value="admin">{isProtectedAdmin(member) ? "Superior Admin" : "Admin"}</option>
                    </select>
                    <button
                      type="button"
                      className="secondary-btn member-remove-btn"
                      disabled={memberBusy || membersLoading || isProtectedAdmin(member)}
                      title={isProtectedAdmin(member) ? "This admin account cannot be removed" : undefined}
                      onClick={() => openRemoveMember(member)}
                    >
                      {isProtectedAdmin(member) ? "Protected" : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isAdmin && modal === "remove-member" && memberToRemove && (
              <div className="form-stack subject-form">
                <div className="subject-delete-hero">
                  <div className="subject-modal-icon danger"><Trash2 size={18} /></div>
                  <div>
                    <span className="eyebrow">REMOVE MEMBER</span>
                    <h3>Are You Sure to Remove the Member?</h3>
                  </div>
                </div>
                {memberError && <div className="modal-notice error" role="alert">{memberError}</div>}
                <p className="delete-confirmation-copy">
                  <strong>{memberToRemove.full_name}</strong> ({memberToRemove.email}) will be permanently removed from Supabase. Their uploaded materials and completion records will also be deleted. Members who authored announcements or assignments must have those records reassigned or deleted first.
                </p>
                <div className="subject-modal-actions">
                  <button type="button" className="secondary-btn" disabled={memberBusy} onClick={() => { setMemberToRemove(null); setMemberError(""); setModal("members"); }}>Cancel</button>
                  <button type="button" className="primary-btn danger-btn" disabled={memberBusy} onClick={() => { void removeMember(); }}>
                    {memberBusy ? "Removing…" : "Remove member"}
                  </button>
                </div>
              </div>
            )}

            {notice && <div className="modal-notice">{notice}</div>}
          </div>
        </div>
      )}

      <div id="setup" className="setup-anchor" />
    </main>
  );
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        {icon}
        <span>{label}</span>
      </div>
      <b>{value}</b>
      <small>{note}</small>
    </div>
  );
}

function AnnouncementCard({
  item,
  canManage = false,
  onEdit,
  onDelete,
}: {
  item: Announcement;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="announcement-card">
      <div className={`announcement-symbol ${item.important ? "important" : ""}`}>
        <Bell size={18} />
      </div>
      <div className="announcement-content">
        <div className="announcement-meta">
          {item.important && <span className="important-tag">IMPORTANT</span>}
          <span>{new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
      </div>
      {canManage ? (
        <div className="announcement-actions">
          <button type="button" className="announcement-action-btn" aria-label={`Edit announcement: ${item.title}`} title="Edit announcement" onClick={onEdit}>
            <Pencil size={15} />
          </button>
          <button type="button" className="announcement-action-btn danger" aria-label={`Delete announcement: ${item.title}`} title="Delete announcement" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <ArrowUpRight className="announcement-arrow" size={18} />
      )}
    </article>
  );
}

function TaskRow({
  item,
  done,
  onToggle,
  canManage = false,
  onEdit,
  onDelete,
}: {
  item: Assignment;
  done: boolean;
  onToggle: () => void;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const late = !done && item.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div className={`task-row ${done ? "is-done" : ""}`}>
      <button className={`task-check ${done ? "checked" : ""}`} onClick={onToggle} aria-label="Toggle completion">
        {done && <Check size={14} />}
      </button>
      <div className="task-info">
        <b>{item.title}</b>
        <span>
          {item.subject}{item.description && <> <i>·</i> {item.description}</>}
        </span>
        {item.attachment_url && (
          <div className="task-attachment-wrap">
            <a
              href={`/api/download?url=${encodeURIComponent(item.attachment_url)}&name=${encodeURIComponent(item.file_name || item.title + ".pdf")}`}
              target="_blank"
              rel="noreferrer"
              download
              className="task-attachment-pill"
              title={`Download assignment PDF: ${item.file_name || item.title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={13} />
              <span>{item.file_name || "Download PDF"}</span>
            </a>
          </div>
        )}
      </div>
      <div className={`due-date ${late ? "late" : ""}`}>
        {late ? "Overdue" : done ? "Completed" : `Due ${new Date(item.due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
      </div>
      {canManage && (
        <div className="announcement-actions">
          <button type="button" className="announcement-action-btn" aria-label={`Edit assignment: ${item.title}`} title="Edit assignment" onClick={onEdit}>
            <Pencil size={15} />
          </button>
          <button type="button" className="announcement-action-btn danger" aria-label={`Delete assignment: ${item.title}`} title="Delete assignment" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Guide({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="guide-card">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
