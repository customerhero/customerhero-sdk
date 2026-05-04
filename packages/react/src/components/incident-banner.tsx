import { useState, type CSSProperties } from "react";
import type { IncidentBanner as IncidentBannerData } from "@customerhero/js";
import { useChat } from "../use-chat";

// Per-severity color tokens. Soft tinted backgrounds with a matching
// foreground for the title and a darker accent for the icon + link CTA.
// Calibrated to read informational below the brand-colored header rather
// than competing with it.
const PALETTE: Record<
  IncidentBannerData["severity"],
  {
    bg: string;
    fg: string;
    fgMuted: string;
    accent: string;
    iconBg: string;
    iconFg: string;
  }
> = {
  info: {
    bg: "#EFF6FF",
    fg: "#1E3A8A",
    fgMuted: "#3B5BA9",
    accent: "#2563EB",
    iconBg: "#DBEAFE",
    iconFg: "#2563EB",
  },
  warning: {
    bg: "#FFFBEB",
    fg: "#78350F",
    fgMuted: "#92541A",
    accent: "#B45309",
    iconBg: "#FEF3C7",
    iconFg: "#B45309",
  },
  outage: {
    bg: "#FEF2F2",
    fg: "#991B1B",
    fgMuted: "#B23A3A",
    accent: "#DC2626",
    iconBg: "#FEE2E2",
    iconFg: "#DC2626",
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
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (severity === "outage") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
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
  const [linkHover, setLinkHover] = useState(false);
  const [closeHover, setCloseHover] = useState(false);

  if (!incidentBanner || incidentBannerDismissed) return null;

  const palette = PALETTE[incidentBanner.severity];

  const wrap: CSSProperties = {
    background: palette.bg,
    color: palette.fg,
    padding: "12px 14px 12px 12px",
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    fontSize: 13,
    lineHeight: 1.45,
    boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.04)",
  };

  const iconBadge: CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: palette.iconBg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "-0.005em",
  };

  const bodyStyle: CSSProperties = {
    margin: "3px 0 0",
    fontSize: 12.5,
    color: palette.fgMuted,
  };

  // ETA renders as a subtle inline pill rather than italic text — reads as
  // metadata at a glance without competing with the title for emphasis.
  const etaStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    color: palette.accent,
    background: palette.iconBg,
    lineHeight: 1.2,
  };

  const linkStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    color: palette.accent,
    textDecoration: linkHover ? "underline" : "none",
    textUnderlineOffset: 3,
    fontSize: 12.5,
    fontWeight: 600,
  };

  const closeButtonStyle: CSSProperties = {
    background: closeHover ? "rgba(0,0,0,0.06)" : "transparent",
    border: "none",
    color: palette.fgMuted,
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
    flexShrink: 0,
    lineHeight: 0,
    marginTop: -2,
    marginRight: -2,
    transition: "background-color 0.12s ease",
  };

  // Outage gets `role="alert"` for assistive-tech immediacy; info/warning
  // are `role="status"` so they're announced politely.
  const role = incidentBanner.severity === "outage" ? "alert" : "status";

  return (
    <div role={role} style={wrap}>
      <div style={iconBadge}>
        <SeverityIcon
          severity={incidentBanner.severity}
          color={palette.iconFg}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={titleStyle}>{incidentBanner.title}</p>
        {incidentBanner.body ? (
          <p style={bodyStyle}>{incidentBanner.body}</p>
        ) : null}
        {incidentBanner.eta ? (
          <span style={etaStyle}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {incidentBanner.eta}
          </span>
        ) : null}
        {incidentBanner.link ? (
          <div>
            <a
              href={incidentBanner.link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
              onMouseEnter={() => setLinkHover(true)}
              onMouseLeave={() => setLinkHover(false)}
            >
              {incidentBanner.link.label ?? t("incident_default_link_label")}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismissIncidentBanner}
        aria-label={t("incident_dismiss")}
        style={closeButtonStyle}
        onMouseEnter={() => setCloseHover(true)}
        onMouseLeave={() => setCloseHover(false)}
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
