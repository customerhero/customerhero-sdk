import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { PreChatField, PreChatSubmission } from "@customerhero/js";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatSuggestions } from "./chat-suggestions";
import { ChatInput } from "./chat-input";

function ConfigError({ message, title }: { message: string; title: string }) {
  const errorStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    textAlign: "center",
    gap: 8,
  };

  return (
    <div style={errorStyle}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#999"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p style={{ fontSize: 14, fontWeight: 500, color: "#333", margin: 0 }}>
        {title}
      </p>
      <p style={{ fontSize: 12, color: "#999", margin: 0 }}>{message}</p>
    </div>
  );
}

// Pre-chat form is internal-only: the same React shell that owns the chat
// window also owns this gating overlay. Kept inline so the React package
// surface stays narrow.
function fieldKey(field: PreChatField): string {
  if (
    field.kind === "name" ||
    field.kind === "email" ||
    field.kind === "phone"
  ) {
    return field.kind;
  }
  return field.key;
}

function fieldLabel(field: PreChatField): string {
  if (field.kind === "name") return field.label ?? "Name";
  if (field.kind === "email") return field.label ?? "Email";
  if (field.kind === "phone") return field.label ?? "Phone";
  return field.label;
}

function validateField(
  field: PreChatField,
  value: string | boolean | undefined,
): string | null {
  const required = "required" in field ? !!field.required : false;
  if (required && (value === undefined || value === "" || value === false)) {
    return "Required";
  }
  if (field.kind === "email" && typeof value === "string" && value !== "") {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return "Invalid email";
  }
  return null;
}

function PreChatFormView() {
  const { preChatForm, submitPreChatForm, cancelPreChatForm, config, t } =
    useChat();
  const [values, setValues] = useState<
    Record<string, string | boolean | undefined>
  >({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!preChatForm) return null;

  function setValue(key: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: null }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!preChatForm) return;
    const nextErrors: Record<string, string | null> = {};
    let hasError = false;
    for (const f of preChatForm.fields) {
      const k = fieldKey(f);
      const err = validateField(f, values[k]);
      nextErrors[k] = err;
      if (err) hasError = true;
    }
    setErrors(nextErrors);
    if (hasError) return;

    const submission: PreChatSubmission = {};
    const properties: Record<string, string | number | boolean> = {};
    for (const f of preChatForm.fields) {
      const k = fieldKey(f);
      const v = values[k];
      if (v === undefined || v === "") continue;
      if (f.kind === "name" && typeof v === "string") submission.name = v;
      else if (f.kind === "email" && typeof v === "string")
        submission.email = v;
      else if (f.kind === "phone" && typeof v === "string")
        submission.phone = v;
      else if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        properties[k] = v;
      }
    }
    if (Object.keys(properties).length > 0) submission.properties = properties;

    setSubmitting(true);
    try {
      await submitPreChatForm(submission);
    } finally {
      setSubmitting(false);
    }
  }

  const containerStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: config.backgroundColor,
    color: config.textColor,
  };
  const labelStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };
  const inputStyle: CSSProperties = {
    width: "100%",
    border: "1px solid #d4d4d8",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 14,
    background: "white",
    color: "#111",
    boxSizing: "border-box",
  };
  const errorStyle: CSSProperties = { color: "#dc2626", fontSize: 12 };
  const buttonRowStyle: CSSProperties = {
    display: "flex",
    gap: 8,
    marginTop: 8,
  };
  const submitStyle: CSSProperties = {
    flex: 1,
    background: config.primaryColor,
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: submitting ? "not-allowed" : "pointer",
    opacity: submitting ? 0.7 : 1,
  };
  const cancelStyle: CSSProperties = {
    background: "transparent",
    color: config.textColor,
    border: "1px solid #d4d4d8",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    cursor: "pointer",
  };

  return (
    <form
      style={containerStyle}
      onSubmit={handleSubmit}
      data-customerhero-prechat-form
    >
      {preChatForm.title && (
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
          {preChatForm.title}
        </h3>
      )}
      {preChatForm.description && (
        <p style={{ fontSize: 13, margin: 0, opacity: 0.8 }}>
          {preChatForm.description}
        </p>
      )}
      {preChatForm.fields.map((field) => {
        const k = fieldKey(field);
        const v = values[k];
        const err = errors[k];
        const required = "required" in field ? !!field.required : false;
        const label = fieldLabel(field);

        if (field.kind === "textarea") {
          return (
            <label key={k} style={labelStyle}>
              <span>
                {label}
                {required && " *"}
              </span>
              <textarea
                style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                value={(v as string) ?? ""}
                maxLength={field.maxLength}
                onChange={(e) => setValue(k, e.target.value)}
              />
              {err && <span style={errorStyle}>{err}</span>}
            </label>
          );
        }
        if (field.kind === "select") {
          return (
            <label key={k} style={labelStyle}>
              <span>
                {label}
                {required && " *"}
              </span>
              <select
                style={inputStyle}
                value={(v as string) ?? ""}
                onChange={(e) => setValue(k, e.target.value)}
              >
                <option value="">—</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {err && <span style={errorStyle}>{err}</span>}
            </label>
          );
        }
        if (field.kind === "consent") {
          return (
            <label
              key={k}
              style={{
                ...labelStyle,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={v === true}
                onChange={(e) => setValue(k, e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: 13, fontWeight: 400 }}>
                {field.label}
                {field.url && (
                  <>
                    {" "}
                    <a
                      href={field.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: config.primaryColor }}
                    >
                      ↗
                    </a>
                  </>
                )}
              </span>
              {err && <span style={errorStyle}>{err}</span>}
            </label>
          );
        }

        const inputType =
          field.kind === "email"
            ? "email"
            : field.kind === "phone"
              ? "tel"
              : "text";
        const maxLength = field.kind === "text" ? field.maxLength : undefined;
        return (
          <label key={k} style={labelStyle}>
            <span>
              {label}
              {required && " *"}
            </span>
            <input
              type={inputType}
              style={inputStyle}
              value={(v as string) ?? ""}
              maxLength={maxLength}
              onChange={(e) => setValue(k, e.target.value)}
            />
            {err && <span style={errorStyle}>{err}</span>}
          </label>
        );
      })}

      <div style={buttonRowStyle}>
        <button
          type="button"
          onClick={cancelPreChatForm}
          style={cancelStyle}
          disabled={submitting}
        >
          {t("action_cancel")}
        </button>
        <button type="submit" style={submitStyle} disabled={submitting}>
          {preChatForm.submitLabel}
        </button>
      </div>
    </form>
  );
}

export function ChatWindow() {
  const { isOpen, config, configError, t, isRtl, preChatFormVisible } =
    useChat();
  const reduced = useReducedMotion();
  // Track render visibility separately to allow exit animation
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Next frame: trigger enter animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      if (reduced) {
        setShouldRender(false);
      } else {
        // Wait for exit animation
        const timer = setTimeout(() => setShouldRender(false), 250);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, reduced]);

  if (!shouldRender) return null;

  // Mirror the launcher: an RTL locale flips the window to the opposite
  // corner so it stays visually attached to its (also-flipped) launcher.
  const effectivePosition = isRtl
    ? config.position === "bottom-right"
      ? "bottom-left"
      : "bottom-right"
    : config.position;

  const style: CSSProperties = {
    position: "fixed",
    bottom: 90,
    [effectivePosition === "bottom-left" ? "left" : "right"]: 20,
    width: 380,
    maxWidth: "calc(100vw - 40px)",
    height: 520,
    maxHeight: "calc(100vh - 120px)",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
    zIndex: 99999,
    background: config.backgroundColor,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    opacity: visible ? 1 : 0,
    transform: visible
      ? "translateY(0) scale(1)"
      : "translateY(16px) scale(0.97)",
    transition: reduced ? "none" : "opacity 0.25s ease, transform 0.25s ease",
  };

  const poweredStyle: CSSProperties = {
    textAlign: "center",
    padding: 6,
    fontSize: 10,
    color: "#aaa",
  };

  const linkStyle: CSSProperties = {
    color: "#888",
    textDecoration: "underline",
    textUnderlineOffset: 2,
  };

  return (
    <div style={style} dir={isRtl ? "rtl" : "ltr"}>
      <ChatHeader />
      {configError ? (
        <ConfigError title={t("unable_to_load")} message={configError} />
      ) : preChatFormVisible ? (
        <PreChatFormView />
      ) : (
        <>
          <ChatMessages />
          <ChatSuggestions />
          <ChatInput />
        </>
      )}
      <div style={poweredStyle}>
        {t("powered_by")}{" "}
        <a
          href="https://customerhero.app"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          CustomerHero
        </a>
      </div>
    </div>
  );
}
