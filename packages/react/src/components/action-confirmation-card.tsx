import { useState, type CSSProperties } from "react";
import type { ActionConfirmationBlock, TranslateFn } from "@customerhero/js";

export interface ActionConfirmationCardProps {
  block: ActionConfirmationBlock;
  primaryColor: string;
  t: TranslateFn;
  onApprove: (pendingId: string) => Promise<void>;
  onCancel: (pendingId: string) => Promise<void>;
}

type Choice = "approve" | "cancel";

export function ActionConfirmationCard({
  block,
  primaryColor,
  t,
  onApprove,
  onCancel,
}: ActionConfirmationCardProps) {
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [showSpinner, setShowSpinner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const handle = async (choice: Choice) => {
    if (chosen) return;
    setChosen(choice);
    setError(null);
    const spinnerTimer = window.setTimeout(() => setShowSpinner(true), 800);
    try {
      const fn = choice === "approve" ? onApprove : onCancel;
      await fn(block.pendingToolCallId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("action_failed");
      setError(msg);
      setChosen(null);
    } finally {
      window.clearTimeout(spinnerTimer);
      setShowSpinner(false);
    }
  };

  const cardStyle: CSSProperties = {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e0e0e0",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 13,
    lineHeight: 1.4,
  };

  const titleStyle: CSSProperties = {
    fontWeight: 600,
    color: "#222",
  };

  const disclosureBtn: CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    color: primaryColor,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  };

  const summaryStyle: CSSProperties = {
    color: "#555",
    background: "#fafafa",
    padding: 8,
    borderRadius: 8,
    whiteSpace: "pre-wrap",
  };

  const buttonRow: CSSProperties = {
    display: "flex",
    gap: 8,
    marginTop: 4,
  };

  const baseBtn = (variant: "primary" | "ghost"): CSSProperties => ({
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: chosen ? "default" : "pointer",
    border:
      variant === "primary" ? `1px solid ${primaryColor}` : "1px solid #ddd",
    background: variant === "primary" ? primaryColor : "#fff",
    color: variant === "primary" ? "#fff" : "#333",
    opacity:
      chosen && chosen !== (variant === "primary" ? "approve" : "cancel")
        ? 0.5
        : 1,
    transition: "opacity 0.15s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontFamily: "inherit",
  });

  return (
    <div style={cardStyle} role="group" aria-label={block.title}>
      <div style={titleStyle}>{block.title}</div>
      {block.summary && (
        <>
          <button
            type="button"
            style={disclosureBtn}
            onClick={() => setShowSummary((s) => !s)}
            aria-expanded={showSummary}
          >
            {showSummary ? "▾" : "▸"} {t("action_what_will_happen")}
          </button>
          {showSummary && <div style={summaryStyle}>{block.summary}</div>}
        </>
      )}
      <div style={buttonRow}>
        <button
          type="button"
          style={baseBtn("ghost")}
          disabled={chosen !== null}
          onClick={() => handle("cancel")}
        >
          {chosen === "cancel" && showSpinner ? (
            <Spinner color="#333" />
          ) : (
            t("action_cancel")
          )}
        </button>
        <button
          type="button"
          style={baseBtn("primary")}
          disabled={chosen !== null}
          onClick={() => handle("approve")}
        >
          {chosen === "approve" && showSpinner ? (
            <Spinner color="#fff" />
          ) : (
            t("action_approve")
          )}
        </button>
      </div>
      {error && (
        <div role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <>
      <style>
        {`@keyframes ch-spin { to { transform: rotate(360deg); } }`}
      </style>
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          borderTopColor: "transparent",
          animation: "ch-spin 0.8s linear infinite",
          display: "inline-block",
        }}
      />
    </>
  );
}
