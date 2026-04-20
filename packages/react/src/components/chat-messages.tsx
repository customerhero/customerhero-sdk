import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChatMessage, MessageRating, TranslateFn } from "@customerhero/js";
import { useChat } from "../use-chat";
import { useReducedMotion } from "../use-reduced-motion";

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
    if (animate && !reduced) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
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

function Message({
  message,
  config,
  onRate,
  hasConversation,
  t,
  animate,
  reduced,
}: {
  message: ChatMessage;
  config: { primaryColor: string; textColor: string };
  onRate: (messageId: string, rating: MessageRating) => Promise<void>;
  hasConversation: boolean;
  t: TranslateFn;
  animate: boolean;
  reduced: boolean;
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
          background: "#f0f0f0",
          color: config.textColor,
          borderBottomLeftRadius: 4,
        }),
  };

  return (
    <AnimatedMessage isUser={isUser} animate={animate} reduced={reduced}>
      <div style={bubbleStyle}>{message.content}</div>
      {message.role === "bot" && message.id && hasConversation && (
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
  const { messages, isLoading, error, config, conversationId, rateMessage, t } =
    useChat();
  const reduced = useReducedMotion();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const prevMessageCount = useRef(0);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: isFirstRender.current || reduced ? "auto" : "smooth",
      });
      isFirstRender.current = false;
    }
  }, [messages, isLoading, reduced]);

  // Track which messages are "new" (added after initial load)
  const newStartIndex = isFirstRender.current
    ? messages.length
    : prevMessageCount.current;
  useEffect(() => {
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  const containerStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  return (
    <div style={containerStyle}>
      {messages.map((msg, i) => (
        <Message
          key={i}
          message={msg}
          config={config}
          onRate={rateMessage}
          hasConversation={conversationId !== null}
          t={t}
          animate={i >= newStartIndex}
          reduced={reduced}
        />
      ))}
      {isLoading && <TypingDots reduced={reduced} />}
      {error && (
        <div
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
