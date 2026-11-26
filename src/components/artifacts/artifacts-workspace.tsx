"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, FileText, Search, Upload, X } from "lucide-react";
import { useOrganization } from "@/components/auth/organization-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getArtifactDocuments, importArtifactDocument } from "@/lib/auth/artifact-actions";
import { artifactMaxBytes, validateArtifactFile, type ArtifactDocument } from "@/lib/artifact-documents";
import { workspaceArtifacts, artifactMarkdown } from "@/lib/workspace-artifacts";

type Library = Awaited<ReturnType<typeof getArtifactDocuments>>;
const references: ArtifactDocument[] = workspaceArtifacts.map((item) => ({
  id: "reference-" + item.id,
  title: item.title,
  fileName: item.id + ".md",
  authorName: "Roaya Connect",
  createdAt: null,
  reference: true,
  content: artifactMarkdown(item),
}));
type ReadArtifactFile = { name: string; content: string; title: string };

/** Reads and checks a dropped or chosen file. Throws a user-facing message. */
async function readArtifactFile(selected: File): Promise<ReadArtifactFile> {
  if (selected.size > artifactMaxBytes) throw Error("Choose a file up to 512 KB.");
  if (!/\.(md|markdown|txt)$/i.test(selected.name)) throw Error("Choose an .md, .markdown or .txt file. Other file types belong in Assets library.");
  const content = await selected.text();
  const title = (content.match(/^#\s+(.+)$/m)?.[1] ?? selected.name.replace(/\.[^.]+$/, " ")).trim().slice(0, 160);
  validateArtifactFile(selected.name, content, title);
  return { name: selected.name, content, title };
}

function hasDraggedFiles(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function ArtifactsWorkspace() {
  const { activeOrganization } = useOrganization();
  return activeOrganization ? (
    <Hub key={activeOrganization.id} organizationId={activeOrganization.id} />
  ) : (
    <p>Select your workspace to view artifacts.</p>
  );
}
function Hub({ organizationId }: { organizationId: string }) {
  const [result, setResult] = useState<Library | null>(null);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All artifacts");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [dropped, setDropped] = useState<{ file: ReadArtifactFile | null; error: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [imported, setImported] = useState<{ id: string; title: string } | null>(null);
  const dragDepth = useRef(0);
  const canUpload = Boolean(result?.ok && result.canUpload);
  function openImport(initial: { file: ReadArtifactFile | null; error: string } | null = null) {
    setDropped(initial);
    setImporting(true);
  }
  async function dropFiles(list: File[]) {
    if (!list.length) return;
    if (list.length > 1) return openImport({ file: null, error: "Drop one file at a time." });
    try {
      openImport({ file: await readArtifactFile(list[0]), error: "" });
    } catch (e) {
      openImport({ file: null, error: e instanceof Error ? e.message : "File could not be read." });
    }
  }
  useEffect(() => {
    let active = true;
    getArtifactDocuments(organizationId)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setResult({ ok: false, message: "Team artifacts could not be loaded." });
      });
    return () => {
      active = false;
    };
  }, [organizationId, retry]);
  const files = result?.ok ? result.documents : [];
  const all = [...files, ...references];
  const needle = query.trim().toLowerCase();
  const matching = all.filter(
    (item) =>
      (category === "All artifacts" || (category === "Team files" && !item.reference) || (category === "Workspace references" && item.reference)) &&
      (!needle || [item.title, item.fileName, item.authorName].join(" ").toLowerCase().includes(needle)),
  );
  const pages = Math.max(1, Math.ceil(matching.length / 6));
  const current = Math.min(page, pages);
  const offset = (current - 1) * 6;
  return (
    <div
      className="relative grid gap-6"
      onDragEnter={(event) => {
        if (!canUpload || importing || !hasDraggedFiles(event)) return;
        event.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!canUpload || importing || !hasDraggedFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!canUpload || importing) return;
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        if (!canUpload || importing || !hasDraggedFiles(event)) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void dropFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {dragging ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-3 z-[70] grid place-items-center rounded-3xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[2px]"
        >
          <div className="grid justify-items-center gap-2 rounded-2xl bg-background px-8 py-6 text-center shadow-xl">
            <Upload className="size-8 text-primary" />
            <p className="text-base font-semibold">Drop to import into Artifact hub</p>
            <p className="text-xs text-muted-foreground">MD, Markdown or TXT, up to 512 KB</p>
          </div>
        </div>
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="roaya-page-title">Artifact hub</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Briefs, handovers and working documents. Import a Markdown or text file and read it as a document, right here.
          </p>
        </div>
        {canUpload ? (
          <div className="grid justify-items-end gap-1">
            <Button className="gap-2" onClick={() => openImport()}>
              <Upload className="size-4" aria-hidden />
              Import file
            </Button>
            <span className="hidden text-xs text-muted-foreground sm:block">or drag a file onto this page</span>
          </div>
        ) : null}
      </header>
      {imported ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{imported.title}</span> was imported into Team files.
          </span>
          <Link href={"/artifacts/" + imported.id} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Open
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
          <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dismiss" onClick={() => setImported(null)}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
      <section className="roaya-glass flex flex-wrap items-center gap-5 rounded-2xl border border-border p-5 sm:p-7">
        <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <FileText className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">Documents that stay with your team.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Read formatted Markdown, inspect the source, or download the original file. Team artifacts require workspace access.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="text-2xl font-semibold text-foreground">{files.length}</span> team files
        </div>
      </section>
      {!result ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading team artifacts…
        </p>
      ) : !result.ok ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
          <p role="alert" className="text-sm">
            Team artifacts could not be loaded. Workspace references are still available.
          </p>
          <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
            Retry
          </Button>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Artifact collections" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
          {["All artifacts", "Team files", "Workspace references"].map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={category === item}
              onClick={() => {
                setCategory(item);
                setPage(1);
              }}
              className={
                "shrink-0 rounded-lg px-4 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring " +
                (category === item ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-muted")
              }
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            className="h-11 ps-9"
            aria-label="Search artifact files"
            placeholder="Search titles, files or people…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {matching.length} {matching.length === 1 ? "artifact" : "artifacts"}
      </p>
      {matching.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matching.slice(offset, offset + 6).map((item) => (
            <li key={item.id} className="roaya-glass flex min-w-0 flex-col rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  {item.reference ? <BookOpen className="size-5" aria-hidden /> : <FileText className="size-5" aria-hidden />}
                </span>
                <Badge variant="outline">{item.fileName.split(".").pop()?.toUpperCase()}</Badge>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{item.reference ? "Workspace reference" : "Team file"}</p>
              <h2 className="mt-2 break-words text-base font-semibold">
                <Link href={"/artifacts/" + item.id} className="hover:text-primary">
                  {item.title}
                </Link>
              </h2>
              <p className="mt-2 truncate text-xs text-muted-foreground" title={item.fileName}>
                {item.fileName}
              </p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="min-w-0 truncate text-xs text-muted-foreground">{item.authorName}</span>
                <Link
                  href={"/artifacts/" + item.id}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Open artifact
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="roaya-glass grid justify-items-center gap-3 rounded-2xl p-10 text-center">
          <FileText className="size-9 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">{query ? "No matching artifacts" : "Bring your first document into the hub"}</h2>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            {query
              ? "Try another title, file name or person."
              : "Import an .md, .markdown or .txt file. It will be saved for your workspace and open as an artifact document."}
          </p>
          {canUpload ? (
            <>
              <Button onClick={() => openImport()}>Import file</Button>
              <p className="text-xs text-muted-foreground">or drag a file onto this page</p>
            </>
          ) : null}
        </div>
      )}
      {matching.length ? (
        <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + 6, matching.length)} of {matching.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Previous artifact page" disabled={current === 1} onClick={() => setPage(current - 1)}>
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="text-xs">
              {current} / {pages}
            </span>
            <Button variant="outline" size="icon" aria-label="Next artifact page" disabled={current === pages} onClick={() => setPage(current + 1)}>
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </footer>
      ) : null}
      {importing ? (
        <ImportDialog
          organizationId={organizationId}
          initial={dropped}
          onClose={() => {
            setImporting(false);
            setDropped(null);
          }}
          onImported={(item) => {
            setImporting(false);
            setDropped(null);
            setImported(item);
            setCategory("All artifacts");
            setQuery("");
            setPage(1);
            setRetry((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
}
function ImportDialog({
  organizationId,
  initial,
  onClose,
  onImported,
}: {
  organizationId: string;
  initial: { file: ReadArtifactFile | null; error: string } | null;
  onClose: () => void;
  onImported: (item: { id: string; title: string }) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.file?.title ?? "");
  const [file, setFile] = useState<{ name: string; content: string } | null>(initial?.file ?? null);
  const [pending, setPending] = useState<"import" | "open" | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState(initial?.error ?? "");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const version = useRef(0);
  async function choose(selected: File | undefined) {
    const current = ++version.current;
    setFile(null);
    setError("");
    if (!selected) return;
    setReading(true);
    try {
      const read = await readArtifactFile(selected);
      if (current === version.current) {
        setFile({ name: read.name, content: read.content });
        setTitle(read.title);
      }
    } catch (e) {
      if (current === version.current) setError(e instanceof Error ? e.message : "File could not be read.");
    } finally {
      if (current === version.current) setReading(false);
    }
  }
  async function save(open: boolean) {
    if (pending || !file) return;
    setPending(open ? "open" : "import");
    setError("");
    try {
      const result = await importArtifactDocument(organizationId, file.name, file.content, title);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (open) {
        router.push("/artifacts/" + result.id);
        router.refresh();
        onClose();
      } else onImported({ id: result.id, title: title.trim() });
    } catch {
      setError("File could not be imported. Try again.");
    } finally {
      setPending(null);
    }
  }
  const busy = Boolean(pending);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent showCloseButton={!busy} className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import an artifact</DialogTitle>
          <DialogDescription>
            Save a Markdown or text document for your workspace. It will open inside Artifact Hub, with its original source available.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save(true);
          }}
        >
          <div className="grid gap-2 text-sm">
            <span id="artifact-file-label">File</span>
            <div
              className={
                "relative grid justify-items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors " +
                (busy ? "opacity-50 " : "") +
                (dragging ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:border-primary/50")
              }
              onDragEnter={(event) => {
                if (!hasDraggedFiles(event)) return;
                event.preventDefault();
                event.stopPropagation();
                dragDepth.current++;
                if (!busy) setDragging(true);
              }}
              onDragOver={(event) => {
                if (!hasDraggedFiles(event)) return;
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = busy ? "none" : "copy";
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (!dragDepth.current) setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                dragDepth.current = 0;
                setDragging(false);
                if (busy || !hasDraggedFiles(event)) return;
                const list = Array.from(event.dataTransfer.files);
                if (list.length > 1) {
                  setError("Drop one file at a time.");
                  return;
                }
                void choose(list[0]);
              }}
            >
              <Upload className="size-7 text-primary" aria-hidden />
              <p className="font-medium">{dragging ? "Drop the file here" : file ? "Drop another file to replace it" : "Drag and drop your file here"}</p>
              <p className="text-xs text-muted-foreground">or</p>
              <input
                type="file"
                aria-labelledby="artifact-file-label"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                disabled={busy}
                onChange={(event) => {
                  void choose(event.target.files?.[0]);
                  event.target.value = "";
                }}
                className="w-full min-w-0 max-w-xs text-sm file:me-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground"
              />
            </div>
            <span className="text-xs text-muted-foreground">MD, Markdown or TXT, up to 512 KB. Other file types belong in Assets library.</span>
          </div>
          {reading ? (
            <p role="status" className="text-sm">
              Reading file…
            </p>
          ) : null}
          {file ? (
            <>
              <p className="flex items-center gap-2 break-all text-xs text-muted-foreground">
                <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                {file.name} · {new TextEncoder().encode(file.content).byteLength.toLocaleString()} bytes
              </p>
              <label className="grid gap-2 text-sm">
                Document title
                <Input required maxLength={160} disabled={busy} value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
            </>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="outline" disabled={busy || reading || !file || !title.trim()} onClick={() => void save(false)}>
              {pending === "import" ? "Importing…" : "Import"}
            </Button>
            <Button type="submit" disabled={busy || reading || !file || !title.trim()}>
              {pending === "open" ? "Opening…" : "Import and open"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
