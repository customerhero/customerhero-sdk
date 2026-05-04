import type { CSSProperties } from "react";
import type { IncidentBanner as IncidentBannerData } from "@customerhero/js";
import { useChat } from "../use-chat";

// Color tokens per severity. Flat backgrounds with a left border accent so
// the banner reads as informational rather than competing with the header's
// brand color block above it.
const PALETTE: Record<
  IncidentBannerData["severity"],
  { bg: string; fg: string; accent: string; iconColor: string }
> = {
  info: {
    bg: "#EFF6FF",
    fg: "#1E3A8A",
    accent: "#2563EB",
    iconColor: "#2563EB",
  },
  warning: {
    bg: "#FFFBEB",
    fg: "#78350F",
    accent: "#D97706",
    iconColor: "#D97706",
  },
  outage: {
    bg: "#FEF2F2",
    fg: "#7F1D1D",
    accent: "#DC2626",
    iconColor: "#DC2626",
  },
};

function SeverityIcon({
  severity,
  color,
}: {
  severity: IncidentBannerData["severity"];
  color: string;
}) {
  const props = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (severity === "outage") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (severity === "warning") {
    return (
      <svg {...props}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function IncidentBanner() {
  const { incidentBanner, incidentBannerDismissed, dismissIncidentBanner, t } =
    useChat();

  if (!incidentBanner || incidentBannerDismissed) return null;

  const palette = PALETTE[incidentBanner.severity];

  const wrap: CSSProperties = {
    background: palette.bg,
    color: palette.fg,
    borderLeft: `3px solid ${palette.accent}`,
    padding: "10px 12px",
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    fontSize: 13,
    lineHeight: 1.4,
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
  };

  const bodyStyle: CSSProperties = {
    margin: "2px 0 0",
    fontSize: 12,
    opacity: 0.9,
  };

  const etaStyle: CSSProperties = {
    margin: "4px 0 0",
    fontSize: 11,
    opacity: 0.75,
    fontStyle: "italic",
  };

  const linkStyle: CSSProperties = {
    display: "inline-block",
    marginTop: 6,
    color: palette.accent,
    textDecoration: "underline",
    textUnderlineOffset: 2,
    fontSize: 12,
    fontWeight: 500,
  };

  const dismissButtonStyle: CSSProperties = {
    background: "none",
    border: "none",
    color: palette.fg,
    cursor: "pointer",
    opacity: 0.6,
    padding: 2,
    flexShrink: 0,
    lineHeight: 0,
  };

  const role = incidentBanner.severity === "outage" ? "alert" : "status";

  return (
    <div role={role} style={wrap}>
      <div style={{ paddingTop: 1, flexShrink: 0 }}>
        <SeverityIcon
          severity={incidentBanner.severity}
          color={palette.iconColor}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={titleStyle}>{incidentBanner.title}</p>
        {incidentBanner.body ? (
          <p style={bodyStyle}>{incidentBanner.body}</p>
        ) : null}
        {incidentBanner.eta ? (
          <p style={etaStyle}>{incidentBanner.eta}</p>
        ) : null}
        {incidentBanner.link ? (
          <a
            href={incidentBanner.link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            {incidentBanner.link.label ?? t("incident_default_link_label")}
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismissIncidentBanner}
        aria-label={t("incident_dismiss")}
        style={dismissButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.6";
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
