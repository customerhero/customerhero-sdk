import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  ScreenshotCancelled,
  canCaptureScreenshot,
  captureScreenshot,
} from "@customerhero/js";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";

const MAX_ATTACHMENTS = 3;

// Mirrors the server allowlist in apps/api/src/routes/chatbots.ts. Anything
// outside this set is rejected client-side with a transient error pill so
// the user gets immediate feedback instead of a 415 round-trip.
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;
const ACCEPT_ATTR = ALLOWED_MIME_TYPES.join(",");
function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

type Attachment =
  | {
      id: string;
      status: "uploading";
      previewUrl: string;
      blob: Blob;
      filename?: string;
    }
  | {
      id: string;
      status: "ready";
      previewUrl: string;
      blob: Blob;
      token: string;
      filename?: string;
    }
  | {
      id: string;
      status: "error";
      previewUrl: string;
      blob: Blob;
      filename?: string;
    };

export function ChatInput() {
  const {
    sendMessage,
    uploadAttachment,
    isLoading,
    config,
    t,
    consumePendingPrefill,
    pendingPrefill,
  } = useChat();
  const reduced = useReducedMotion();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [captureSupported, setCaptureSupported] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [transientError, setTransientError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  // dragenter/leave fire on each child too — counter avoids overlay flicker.
  const dragCounterRef = useRef(0);

  // canCaptureScreenshot reads `matchMedia` and `navigator` — defer until
  // after mount so SSR / test environments don't blow up on first render.
  useEffect(() => {
    setCaptureSupported(canCaptureScreenshot());
  }, []);

  // Drain any prefill set by an `open_with_prefill` trigger. Runs once per
  // pendingPrefill change so a new trigger after the first one still wins.
  useEffect(() => {
    if (pendingPrefill === null) return;
    const text = consumePendingPrefill();
    if (text !== null) setValue(text);
  }, [pendingPrefill, consumePendingPrefill]);

  // Revoke blob URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      for (const a of attachments) URL.revokeObjectURL(a.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Auto-clear transient error after 4s so it doesn't linger forever.
  useEffect(() => {
    if (!transientError) return;
    const id = window.setTimeout(() => setTransientError(null), 4000);
    return () => window.clearTimeout(id);
  }, [transientError]);

  const updateAttachment = (id: string, patch: Partial<Attachment>) => {
    setAttachments((current) =>
      current.map((a) =>
        a.id === id ? ({ ...a, ...patch } as Attachment) : a,
      ),
    );
  };

  const startUpload = async (blob: Blob, filename?: string) => {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const previewUrl = URL.createObjectURL(blob);
    setAttachments((current) => [
      ...current,
      { id, status: "uploading", previewUrl, blob, filename },
    ]);
    try {
      const { attachmentToken } = await uploadAttachment(blob, { filename });
      updateAttachment(id, {
        status: "ready",
        token: attachmentToken,
      } as Partial<Attachment>);
    } catch {
      updateAttachment(id, { status: "error" } as Partial<Attachment>);
    }
  };

  // Filter, dedupe-by-slot, then upload. Returns the count actually queued.
  const ingestFiles = (files: FileList | File[] | Blob[]): number => {
    const remainingSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    if (remainingSlots === 0) return 0;
    let queued = 0;
    let rejectedAny = false;
    for (const f of Array.from(files)) {
      if (queued >= remainingSlots) break;
      const type = (f as Blob).type;
      if (
        !ALLOWED_MIME_TYPES.includes(
          type as (typeof ALLOWED_MIME_TYPES)[number],
        )
      ) {
        rejectedAny = true;
        continue;
      }
      const filename =
        typeof (f as File).name === "string" && (f as File).name.length > 0
          ? (f as File).name
          : undefined;
      void startUpload(f as Blob, filename);
      queued += 1;
    }
    if (rejectedAny) {
      setTransientError(t("attachment_unsupported_type"));
    }
    return queued;
  };

  const handleCapture = async () => {
    setMenuOpen(false);
    try {
      const blob = await captureScreenshot();
      await startUpload(blob);
    } catch (e) {
      if (e instanceof ScreenshotCancelled) return;
      // Surfaced via the rendered error pill; nothing to do here.
    }
  };

  const handlePickFile = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      ingestFiles(files);
    }
    // Reset so picking the same file twice still fires `change`.
    e.target.value = "";
  };

  const handleRemove = (id: string) => {
    setAttachments((current) => {
      const target = current.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((a) => a.id !== id);
    });
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;
    const blobs: Blob[] = [];
    for (const item of Array.from(items)) {
      if (item.kind !== "file") continue;
      const blob = item.getAsFile();
      if (blob) blobs.push(blob);
    }
    if (blobs.length === 0) return;
    e.preventDefault();
    ingestFiles(blobs);
  };

  // Drag-and-drop handlers. We attach to the composer container so the
  // overlay covers both the attachment row and the input row. The counter
  // avoids dragenter/dragleave flicker as the cursor moves over children.
  const handleDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setDragActive(true);
  };
  const handleDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
  };
  const handleDragLeave = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragActive(false);
  };
  const handleDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      ingestFiles(files);
    }
  };

  const readyTokens = attachments
    .filter(
      (a): a is Extract<Attachment, { status: "ready" }> =>
        a.status === "ready",
    )
    .map((a) => a.token);

  const handleSend = () => {
    if (!value.trim() || isLoading) return;
    sendMessage(
      value,
      readyTokens.length > 0 ? { attachmentTokens: readyTokens } : undefined,
    );
    // Clean up — next message starts with no carried attachments.
    for (const a of attachments) URL.revokeObjectURL(a.previewUrl);
    setAttachments([]);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    padding: "12px 16px",
    borderTop: "1px solid #eee",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    border: "1px solid #e0e0e0",
    borderRadius: 24,
    padding: "10px 16px",
    fontSize: 14,
    outline: "none",
    background: "#fafafa",
    color: config.textColor,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  const sendButtonStyle: CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: config.primaryColor,
    border: "none",
    color: "white",
    cursor: isLoading ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: isLoading ? 0.5 : 1,
    transition: reduced ? "opacity 0.2s" : "opacity 0.2s, transform 0.15s",
    flexShrink: 0,
    transform: "scale(1)",
  };

  const iconButtonStyle = (disabled: boolean): CSSProperties => ({
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "transparent",
    border: "none",
    color: disabled ? "#ccc" : "#666",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
  });

  const menuStyle: CSSProperties = {
    position: "absolute",
    bottom: "calc(100% + 4px)",
    left: 0,
    background: "white",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    padding: 4,
    minWidth: 180,
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
  };

  const menuItemStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    color: "#333",
    textAlign: "left",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  const dropOverlayStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "rgba(255,255,255,0.92)",
    border: `2px dashed ${config.primaryColor}`,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: config.primaryColor,
    fontSize: 14,
    fontWeight: 500,
    pointerEvents: "none",
    zIndex: 11,
  };

  const errorPillStyle: CSSProperties = {
    alignSelf: "flex-start",
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "4px 10px",
    fontSize: 12,
  };

  const attachDisabled = attachments.length >= MAX_ATTACHMENTS || isLoading;

  return (
    <div
      style={containerStyle}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div style={dropOverlayStyle} aria-hidden="true">
          {t("drop_files_here")}
        </div>
      )}
      {transientError && (
        <div role="alert" style={errorPillStyle}>
          {transientError}
        </div>
      )}
      {attachments.length > 0 && (
        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          aria-label="Attachments"
        >
          {attachments.map((a) => (
            <Thumbnail
              key={a.id}
              attachment={a}
              onRemove={() => handleRemove(a.id)}
              t={t}
            />
          ))}
        </div>
      )}
      <div style={rowStyle}>
        <div style={{ position: "relative" }}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={attachDisabled}
            style={iconButtonStyle(attachDisabled)}
            aria-label={t("attach_menu_open")}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={t("attach_menu_open")}
          >
            <PaperclipIcon />
          </button>
          {menuOpen && (
            <div ref={menuRef} role="menu" style={menuStyle}>
              <button
                type="button"
                role="menuitem"
                onClick={handlePickFile}
                style={menuItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <ImageIcon />
                {t("attach_photo")}
              </button>
              {captureSupported && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleCapture}
                  style={menuItemStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f5f5f5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <CameraIcon />
                  {t("screenshot_capture")}
                </button>
              )}
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          onChange={handleFileInputChange}
          style={{ display: "none" }}
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={config.placeholderText}
          style={inputStyle}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !value.trim()}
          style={sendButtonStyle}
          aria-label={t("send_message")}
          onMouseEnter={(e) => {
            if (!reduced && !isLoading)
              e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            if (!reduced) e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// True iff the drag event carries files (vs. text/URL drags from inside
// the page). Without this check the overlay would flash on selecting text.
function hasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "Files") return true;
  }
  return false;
}

function Thumbnail({
  attachment,
  onRemove,
  t,
}: {
  attachment: Attachment;
  onRemove: () => void;
  t: (k: "attachment_remove" | "status_failed") => string;
}) {
  const { status, previewUrl, blob, filename } = attachment;
  const isImage = isImageMime(blob.type);
  const wrap: CSSProperties = {
    position: "relative",
    width: isImage ? 56 : 160,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    border: status === "error" ? "2px solid #b91c1c" : "1px solid #e0e0e0",
    background: "#f5f5f5",
    display: "flex",
    alignItems: "center",
    justifyContent: isImage ? "stretch" : "flex-start",
    gap: isImage ? 0 : 8,
    padding: isImage ? 0 : "0 8px",
  };
  const img: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
  const removeBtn: CSSProperties = {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.6)",
    color: "white",
    fontSize: 11,
    lineHeight: "18px",
    padding: 0,
    cursor: "pointer",
    textAlign: "center",
  };
  const overlay: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "rgba(255,255,255,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const docName: CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: "#333",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 110,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };
  const docMeta: CSSProperties = {
    fontSize: 11,
    color: "#888",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  const displayName = filename ?? (isImage ? "" : "Document");
  const sizeLabel = formatBytes(blob.size);

  return (
    <div style={wrap}>
      {isImage ? (
        <img src={previewUrl} alt="" style={img} />
      ) : (
        <>
          <DocIcon />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              flex: 1,
            }}
          >
            <span style={docName} title={displayName}>
              {displayName}
            </span>
            {sizeLabel && <span style={docMeta}>{sizeLabel}</span>}
          </div>
        </>
      )}
      {status === "uploading" && (
        <div style={overlay} aria-label="Uploading">
          <Spinner />
        </div>
      )}
      {status === "error" && (
        <div
          style={{ ...overlay, background: "rgba(255,255,255,0.85)" }}
          aria-label={t("status_failed")}
          title={t("status_failed")}
        >
          <span style={{ color: "#b91c1c", fontSize: 11, fontWeight: 600 }}>
            !
          </span>
        </div>
      )}
      <button
        type="button"
        style={removeBtn}
        onClick={onRemove}
        aria-label={t("attachment_remove")}
      >
        ×
      </button>
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: "#666", flexShrink: 0 }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CameraIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function Spinner() {
  return (
    <>
      <style>
        {`@keyframes ch-att-spin { to { transform: rotate(360deg); } }`}
      </style>
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid #888",
          borderTopColor: "transparent",
          animation: "ch-att-spin 0.8s linear infinite",
          display: "inline-block",
        }}
      />
    </>
  );
}
