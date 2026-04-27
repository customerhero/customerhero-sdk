import {
  useEffect,
  useState,
  type CSSProperties,
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

type Attachment =
  | { id: string; status: "uploading"; previewUrl: string; blob: Blob }
  | {
      id: string;
      status: "ready";
      previewUrl: string;
      blob: Blob;
      token: string;
    }
  | { id: string; status: "error"; previewUrl: string; blob: Blob };

export function ChatInput() {
  const { sendMessage, uploadAttachment, isLoading, config, t } = useChat();
  const reduced = useReducedMotion();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [captureSupported, setCaptureSupported] = useState(false);

  // canCaptureScreenshot reads `matchMedia` and `navigator` — defer until
  // after mount so SSR / test environments don't blow up on first render.
  useEffect(() => {
    setCaptureSupported(canCaptureScreenshot());
  }, []);

  // Revoke blob URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      for (const a of attachments) URL.revokeObjectURL(a.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateAttachment = (id: string, patch: Partial<Attachment>) => {
    setAttachments((current) =>
      current.map((a) =>
        a.id === id ? ({ ...a, ...patch } as Attachment) : a,
      ),
    );
  };

  const startUpload = async (blob: Blob) => {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const previewUrl = URL.createObjectURL(blob);
    setAttachments((current) => [
      ...current,
      { id, status: "uploading", previewUrl, blob },
    ]);
    try {
      const { attachmentToken } = await uploadAttachment(blob);
      updateAttachment(id, {
        status: "ready",
        token: attachmentToken,
      } as Partial<Attachment>);
    } catch {
      updateAttachment(id, { status: "error" } as Partial<Attachment>);
    }
  };

  const handleCapture = async () => {
    try {
      const blob = await captureScreenshot();
      await startUpload(blob);
    } catch (e) {
      if (e instanceof ScreenshotCancelled) return;
      // Surfaced via the rendered error pill; nothing to do here.
    }
  };

  const handleRemove = (id: string) => {
    setAttachments((current) => {
      const target = current.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((a) => a.id !== id);
    });
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

  const captureDisabled = attachments.length >= MAX_ATTACHMENTS || isLoading;

  return (
    <div style={containerStyle}>
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
        {captureSupported && (
          <button
            type="button"
            onClick={handleCapture}
            disabled={captureDisabled}
            style={iconButtonStyle(captureDisabled)}
            aria-label={t("screenshot_capture")}
            title={t("screenshot_capture")}
          >
            <CameraIcon />
          </button>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
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

function Thumbnail({
  attachment,
  onRemove,
  t,
}: {
  attachment: Attachment;
  onRemove: () => void;
  t: (k: "attachment_remove" | "status_failed") => string;
}) {
  const { status, previewUrl } = attachment;
  const wrap: CSSProperties = {
    position: "relative",
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    border: status === "error" ? "2px solid #b91c1c" : "1px solid #e0e0e0",
    background: "#f5f5f5",
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

  return (
    <div style={wrap}>
      <img src={previewUrl} alt="" style={img} />
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

function CameraIcon() {
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
