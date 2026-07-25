import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  ChatMessage,
  MessageAttachment,
  MessageBlock,
  MessageRating,
  TranslateFn,
} from "@customerhero/js";
import { useChat } from "../use-chat";
import { useEffectiveTheme } from "../use-effective-theme";
import { useReducedMotion } from "../use-reduced-motion";
import { renderMarkdown } from "../markdown/render";
import { ActionConfirmationCard } from "./action-confirmation-card";

function MessageStatusPill({
  status,
  t,
}: {
  status: NonNullable<ChatMessage["status"]>;
  t: TranslateFn;
}) {
  const failed = status === "failed";
  const containerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 2,
    fontSize: 11,
    color: failed ? "#b91c1c" : "#888",
  };
  const labelKey =
    status === "sending"
      ? "status_sending"
      : status === "sent"
        ? "status_sent"
        : "status_failed";
  return (
    <div style={containerStyle} aria-live="polite">
      {status === "sending" && <ClockIcon />}
      {status === "sent" && <CheckIcon />}
      {status === "failed" && <ExclamationIcon />}
      <span>{t(labelKey)}</span>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ExclamationIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function MessageRatingButtons({
  messageId,
  onRate,
  primaryColor,
  t,
  reduced,
}: {
  messageId: string;
  onRate: (messageId: string, rating: MessageRating) => Promise<void>;
  primaryColor: string;
  t: TranslateFn;
  reduced: boolean;
}) {
  const [rated, setRated] = useState<MessageRating | null>(null);

  const handleRate = (rating: MessageRating) => {
    setRated(rating);
    onRate(messageId, rating);
  };

  const buttonStyle = (isRated: boolean): CSSProperties => ({
    background: isRated ? `${primaryColor}11` : "none",
    border: `1px solid ${isRated ? primaryColor : "#ddd"}`,
    borderRadius: 4,
    padding: "4px 6px",
    cursor: rated ? "default" : "pointer",
    color: isRated ? primaryColor : "#888",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: reduced ? "color 0.15s" : "all 0.15s",
    transform: isRated && !reduced ? "scale(1.15)" : "scale(1)",
  });

  return (
    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
      <button
        onClick={() => handleRate("positive")}
        disabled={rated !== null}
        style={buttonStyle(rated === "positive")}
        title={t("helpful")}
        aria-label={t("helpful")}
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
        >
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>
      <button
        onClick={() => handleRate("negative")}
        disabled={rated !== null}
        style={buttonStyle(rated === "negative")}
        title={t("not_helpful")}
        aria-label={t("not_helpful")}
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
        >
          <path d="M17 14V2" />
          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
    </div>
  );
}

function AnimatedMessage({
  children,
  isUser,
  animate,
  reduced,
}: {
  children: React.ReactNode;
  isUser: boolean;
  animate: boolean;
  reduced: boolean;
}) {
  const [visible, setVisible] = useState(!animate);

  useEffect(() => {
    // If animation is disabled (reduced motion) or this message no longer
    // counts as "new", make it visible immediately. Without this, a streamed
    // bot bubble flips animate=true → false on the first token (the parent's
    // newStartIndex advances), the scheduled RAF gets cancelled, and the
    // bubble stays at opacity: 0 forever.
    if (!animate || reduced) {
      setVisible(true);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [animate, reduced]);

  const style: CSSProperties = {
    alignSelf: isUser ? "flex-end" : "flex-start",
    maxWidth: "80%",
    opacity: visible ? 1 : 0,
    transform: visible
      ? "translateX(0)"
      : `translateX(${isUser ? "12px" : "-12px"})`,
    transition:
      animate && !reduced ? "opacity 0.2s ease, transform 0.2s ease" : "none",
  };

  return <div style={style}>{children}</div>;
}

function ChipRow({
  options,
  onSelect,
  primaryColor,
  reduced,
}: {
  options: string[];
  onSelect: (value: string) => void;
  primaryColor: string;
  reduced: boolean;
}) {
  const chip: CSSProperties = {
    background: "none",
    border: "1px solid #e0e0e0",
    borderRadius: 20,
    padding: "6px 12px",
    fontSize: 13,
    color: "#333",
    cursor: "pointer",
    textAlign: "left",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    transition: reduced ? "none" : "border-color 0.15s, background 0.15s",
  };
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 6,
      }}
    >
      {options.map((text) => (
        <button
          key={text}
          style={chip}
          onClick={() => onSelect(text)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = primaryColor;
            e.currentTarget.style.background = `${primaryColor}08`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e0e0e0";
            e.currentTarget.style.background = "none";
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function BlockRenderer({
  block,
  onSend,
  onApproveAction,
  onCancelAction,
  primaryColor,
  reduced,
  t,
}: {
  block: MessageBlock;
  onSend: (value: string) => void;
  onApproveAction: (pendingId: string) => Promise<void>;
  onCancelAction: (pendingId: string) => Promise<void>;
  primaryColor: string;
  reduced: boolean;
  t: TranslateFn;
}) {
  switch (block.type) {
    case "quick_replies":
      return (
        <ChipRow
          options={block.options}
          onSelect={onSend}
          primaryColor={primaryColor}
          reduced={reduced}
        />
      );
    case "action_confirmation":
      return (
        <ActionConfirmationCard
          block={block}
          primaryColor={primaryColor}
          t={t}
          onApprove={onApproveAction}
          onCancel={onCancelAction}
        />
      );
  }
}

// A blinking caret appended to a bot bubble while tokens are still streaming.
function StreamingCursor({ reduced }: { reduced: boolean }) {
  return (
    <>
      <style>
        {`@keyframes ch-caret-blink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }`}
      </style>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 2,
          height: "1em",
          marginLeft: 2,
          verticalAlign: "text-bottom",
          background: "#777",
          animation: reduced ? "none" : "ch-caret-blink 1s step-start infinite",
        }}
      />
    </>
  );
}

function formatBytes(n: number | null): string | null {
  if (n == null || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentList({
  attachments,
  isUser,
  primaryColor,
  t,
}: {
  attachments: MessageAttachment[];
  isUser: boolean;
  primaryColor: string;
  t: TranslateFn;
}) {
  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 6,
    alignItems: isUser ? "flex-end" : "flex-start",
  };
  return (
    <div style={containerStyle}>
      {attachments.map((a) => (
        <AttachmentTile
          key={a.id}
          attachment={a}
          isUser={isUser}
          primaryColor={primaryColor}
          t={t}
        />
      ))}
    </div>
  );
}

function AttachmentTile({
  attachment,
  isUser,
  primaryColor,
  t,
}: {
  attachment: MessageAttachment;
  isUser: boolean;
  primaryColor: string;
  t: TranslateFn;
}) {
  const tileBg = isUser ? `${primaryColor}11` : "#f3f4f6";
  const tileBorder = isUser ? `${primaryColor}33` : "#e5e7eb";

  if (attachment.kind === "image" && attachment.url) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          maxWidth: "min(220px, 100%)",
          lineHeight: 0,
        }}
        aria-label={attachment.filename ?? t("attachment_image_alt")}
      >
        <img
          src={attachment.url}
          alt={attachment.filename ?? t("attachment_image_alt")}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: 220,
            width: "auto",
            height: "auto",
            borderRadius: 12,
            border: `1px solid ${tileBorder}`,
            objectFit: "cover",
          }}
        />
      </a>
    );
  }

  if (attachment.kind === "location" && attachment.location) {
    const { latitude, longitude, label } = attachment.location;
    const href = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={tileLinkStyle(tileBg, tileBorder)}
      >
        <PinIcon />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={tileTitleStyle()}>
            {label || t("attachment_location")}
          </span>
          <span style={tileSubStyle()}>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </span>
        </div>
      </a>
    );
  }

  // Document / audio / video → generic download tile.
  if (!attachment.url) return null;
  const sub = [attachment.mimeType, formatBytes(attachment.sizeBytes)]
    .filter(Boolean)
    .join(" · ");
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      title={t("attachment_open")}
      style={tileLinkStyle(tileBg, tileBorder)}
    >
      <FileIcon kind={attachment.kind} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={tileTitleStyle()}>
          {attachment.filename ?? t("attachment_open")}
        </span>
        {sub && <span style={tileSubStyle()}>{sub}</span>}
      </div>
    </a>
  );
}

function tileLinkStyle(bg: string, border: string): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 12,
    textDecoration: "none",
    color: "inherit",
    // Never wider than the bubble column it sits in — on a 320 px phone the
    // flat 260 px would have poked out past the message's own max-width.
    maxWidth: "min(260px, 100%)",
    boxSizing: "border-box",
  };
}

function tileTitleStyle(): CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 500,
    color: "#1f2937",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 200,
  };
}

function tileSubStyle(): CSSProperties {
  return {
    fontSize: 11,
    color: "#6b7280",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 200,
  };
}

function FileIcon({ kind }: { kind: MessageAttachment["kind"] }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4b5563"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {kind === "audio" ? (
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>
      ) : kind === "video" ? (
        <>
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="m22 8-6 4 6 4z" />
        </>
      ) : (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </>
      )}
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4b5563"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function Message({
  message,
  config,
  onRate,
  onSend,
  onApproveAction,
  onCancelAction,
  hasConversation,
  t,
  animate,
  reduced,
  showSuggestions,
}: {
  message: ChatMessage;
  config: { primaryColor: string; textColor: string; bubbleBackground: string };
  onRate: (messageId: string, rating: MessageRating) => Promise<void>;
  onSend: (value: string) => void;
  onApproveAction: (pendingId: string) => Promise<void>;
  onCancelAction: (pendingId: string) => Promise<void>;
  hasConversation: boolean;
  t: TranslateFn;
  animate: boolean;
  reduced: boolean;
  showSuggestions: boolean;
}) {
  const isUser = message.role === "user";

  const bubbleStyle: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 16,
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
    ...(isUser
      ? {
          background: config.primaryColor,
          color: "white",
          borderBottomRightRadius: 4,
        }
      : {
          background: config.bubbleBackground,
          color: config.textColor,
          borderBottomLeftRadius: 4,
        }),
  };

  const linkColor = isUser ? "#ffffff" : config.primaryColor;

  const hasContent = message.content.trim().length > 0;
  const hasAttachments = !!message.attachments?.length;

  return (
    <AnimatedMessage isUser={isUser} animate={animate} reduced={reduced}>
      {hasContent && (
        <div
          style={bubbleStyle}
          data-streaming-bubble={
            !isUser && message.streaming ? "true" : undefined
          }
        >
          {isUser ? (
            message.content
          ) : (
            <>
              {renderMarkdown(message.content, {
                sources: message.sources,
                linkColor,
              })}
              {message.streaming && <StreamingCursor reduced={reduced} />}
            </>
          )}
        </div>
      )}
      {hasAttachments && (
        <AttachmentList
          attachments={message.attachments!}
          isUser={isUser}
          primaryColor={config.primaryColor}
          t={t}
        />
      )}
      {isUser && message.status && (
        <MessageStatusPill status={message.status} t={t} />
      )}
      {!isUser &&
        message.blocks?.map((block, i) => (
          <BlockRenderer
            key={i}
            block={block}
            onSend={onSend}
            onApproveAction={onApproveAction}
            onCancelAction={onCancelAction}
            primaryColor={config.primaryColor}
            reduced={reduced}
            t={t}
          />
        ))}
      {!isUser && showSuggestions && message.suggestions?.length ? (
        <ChipRow
          options={message.suggestions}
          onSelect={onSend}
          primaryColor={config.primaryColor}
          reduced={reduced}
        />
      ) : null}
      {message.role === "bot" &&
        message.id &&
        hasConversation &&
        !message.streaming &&
        !message.blocks?.some((b) => b.type === "action_confirmation") && (
          <MessageRatingButtons
            messageId={message.id}
            onRate={onRate}
            primaryColor={config.primaryColor}
            t={t}
            reduced={reduced}
          />
        )}
    </AnimatedMessage>
  );
}

function TypingDots({ reduced }: { reduced: boolean }) {
  const dotStyle = (delay: number): CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#999",
    animation: reduced
      ? "none"
      : `ch-dot-pulse 1.2s ease-in-out ${delay}s infinite`,
  });

  return (
    <>
      <style>
        {`@keyframes ch-dot-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }`}
      </style>
      <div
        style={{
          alignSelf: "flex-start",
          padding: "12px 16px",
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          background: "#f0f0f0",
          display: "flex",
          gap: 4,
          alignItems: "center",
        }}
      >
        <div style={dotStyle(0)} />
        <div style={dotStyle(0.2)} />
        <div style={dotStyle(0.4)} />
      </div>
    </>
  );
}

export function ChatMessages() {
  const {
    messages,
    isLoading,
    error,
    conversationId,
    rateMessage,
    sendMessage,
    approveAction,
    cancelAction,
    t,
  } = useChat();
  const theme = useEffectiveTheme();
  // Adapt the per-message styling shape to the dark-aware palette so message
  // bubbles, links, and rating buttons all read against the live background.
  const themedConfig = {
    primaryColor: theme.primary,
    textColor: theme.text,
    bubbleBackground: theme.bubbleBackground,
  };
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const prevMessageCount = useRef(0);
  // Stick to the bottom while the user is reading the latest content. Goes
  // false the moment they scroll up, comes back true if they scroll back
  // near the bottom themselves. Programmatic scrolls are filtered out by a
  // short suppression window so they don't toggle this themselves.
  const stickRef = useRef(true);
  const suppressScrollRef = useRef(false);

  const autoScrollTo = (top: number) => {
    const el = containerRef.current;
    if (!el) return;
    suppressScrollRef.current = true;
    el.scrollTop = top;
    // One frame is enough for the resulting scroll event to flush.
    requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    });
  };

  const handleScroll = () => {
    if (suppressScrollRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distFromBottom < 60;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // A fresh user message means a new turn started — re-stick so we follow
    // their own message and the response that follows.
    const lastMsg = messages[messages.length - 1];
    if (
      messages.length > prevMessageCount.current &&
      lastMsg?.role === "user"
    ) {
      stickRef.current = true;
    }
    if (!stickRef.current && !isFirstRender.current) {
      // User has scrolled away — leave them alone.
      return;
    }
    // If a streaming bot bubble is taller than the viewport, anchor its top
    // to the top of the scroll container instead of pinning the bottom.
    // Otherwise the start of the reply scrolls off-screen as tokens arrive.
    const streamingBubble = el.querySelector<HTMLElement>(
      "[data-streaming-bubble='true']",
    );
    let target = el.scrollHeight - el.clientHeight;
    if (
      streamingBubble &&
      streamingBubble.offsetHeight > el.clientHeight - 24
    ) {
      const containerTop = el.getBoundingClientRect().top;
      const bubbleTop = streamingBubble.getBoundingClientRect().top;
      // Leave a bit of breathing room above the bubble so it doesn't sit
      // flush against the header — purely aesthetic, but a flush bubble
      // looks like content has been clipped.
      const TOP_GAP = 16;
      target = el.scrollTop + (bubbleTop - containerTop) - TOP_GAP;
      // Once we anchor, stop sticking — the user will scroll manually from
      // here. Without this the next render would try to pin the bottom again.
      stickRef.current = false;
    }
    autoScrollTo(target);
    isFirstRender.current = false;
  }, [messages, isLoading, reduced]);

  // Track which messages are "new" (added after initial load)
  const newStartIndex = isFirstRender.current
    ? messages.length
    : prevMessageCount.current;
  useEffect(() => {
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  // Follow-up suggestions only render on the most recent bot message, and
  // only once it has finished streaming.
  let lastBotIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "bot") {
      lastBotIndex = i;
      break;
    }
  }

  const containerStyle: CSSProperties = {
    flex: 1,
    // `minHeight: 0` keeps this the element that scrolls: without it a flex
    // child refuses to shrink below its content, so on a short (landscape)
    // screen the list would push the composer off the bottom instead of
    // scrolling internally.
    minHeight: 0,
    overflowY: "auto",
    // Don't hand a swipe that runs past the top/bottom of the list to the
    // page behind the widget.
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  // Show the typing indicator while waiting for the first token only.
  // Once a bot bubble exists for this turn, its streaming cursor takes over.
  const lastMsg = messages[messages.length - 1];
  const waitingForFirstToken =
    isLoading && (lastMsg?.role !== "bot" || lastMsg.streaming !== true);

  return (
    <div ref={containerRef} style={containerStyle} onScroll={handleScroll}>
      {messages.map((msg, i) => (
        <Message
          key={i}
          message={msg}
          config={themedConfig}
          onRate={rateMessage}
          onSend={sendMessage}
          onApproveAction={approveAction}
          onCancelAction={cancelAction}
          hasConversation={conversationId !== null}
          t={t}
          animate={i >= newStartIndex}
          reduced={reduced}
          showSuggestions={
            i === lastBotIndex && !isLoading && msg.streaming !== true
          }
        />
      ))}
      {waitingForFirstToken && <TypingDots reduced={reduced} />}
      {error && (
        <div
          role="alert"
          style={{
            alignSelf: "flex-start",
            padding: "10px 14px",
            borderRadius: 16,
            borderBottomLeftRadius: 4,
            fontSize: 13,
            background: "#fee2e2",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
