import { DEFAULTS } from "./defaults";
import {
  createTranslator,
  detectLocale,
  isRtlLocale,
  type StringOverrides,
  type SupportedLocale,
  type TranslateFn,
} from "./i18n";
import { readSSEStream } from "./sse";
import {
  startTriggersRuntime,
  type TriggersRuntimeHandle,
} from "./triggers-runtime";
import type {
  CustomerHeroChatConfig,
  ResolvedConfig,
  ChatMessage,
  ChatState,
  MessageRating,
  MessageSource,
  MessageBlock,
  MessageAttachment,
  IdentifyPayload,
  IdentityData,
  TriggerDefinition,
  TriggerAction,
  PreChatFormConfig,
  PreChatSubmission,
  ConsentSettings,
  IncidentBanner,
} from "./types";

type Listener = (state: ChatState) => void;

function clampInt(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function resolveConfig(
  userConfig: CustomerHeroChatConfig,
  fetched?: Partial<ResolvedConfig>,
): ResolvedConfig {
  // Server payload may carry a partial launcher shape; treat as
  // CustomerHeroChatConfig's nested optional shape rather than the strict
  // ResolvedConfig variant.
  const launcherUser = userConfig.launcher ?? {};
  const launcherFetched: NonNullable<CustomerHeroChatConfig["launcher"]> =
    (fetched?.launcher as NonNullable<CustomerHeroChatConfig["launcher"]>) ??
    {};
  const offsetUser = userConfig.offset ?? {};
  return {
    chatbotId: userConfig.chatbotId,
    apiBase: userConfig.apiBase ?? DEFAULTS.apiBase,
    primaryColor:
      userConfig.primaryColor ?? fetched?.primaryColor ?? DEFAULTS.primaryColor,
    backgroundColor:
      userConfig.backgroundColor ??
      fetched?.backgroundColor ??
      DEFAULTS.backgroundColor,
    textColor: userConfig.textColor ?? fetched?.textColor ?? DEFAULTS.textColor,
    position: userConfig.position ?? fetched?.position ?? DEFAULTS.position,
    placeholderText:
      userConfig.placeholderText ??
      fetched?.placeholderText ??
      DEFAULTS.placeholderText,
    welcomeMessage:
      userConfig.welcomeMessage ??
      fetched?.welcomeMessage ??
      DEFAULTS.welcomeMessage,
    title: userConfig.title ?? fetched?.title ?? DEFAULTS.title,
    avatarUrl: userConfig.avatarUrl ?? fetched?.avatarUrl,
    suggestedMessages:
      userConfig.suggestedMessages ?? fetched?.suggestedMessages ?? [],
    stringOverrides: fetched?.stringOverrides,
    // Appearance pack. Color palette + size + corner style + launcher all
    // come from the server widget_config (with host-side override). The
    // *runtime* knobs — colorScheme, offset, zIndex — are host-only because
    // they depend on the page the widget is embedded in, not the chatbot.
    primaryColorDark: userConfig.primaryColorDark ?? fetched?.primaryColorDark,
    backgroundColorDark:
      userConfig.backgroundColorDark ?? fetched?.backgroundColorDark,
    textColorDark: userConfig.textColorDark ?? fetched?.textColorDark,
    size: userConfig.size ?? fetched?.size ?? DEFAULTS.size,
    cornerStyle:
      userConfig.cornerStyle ?? fetched?.cornerStyle ?? DEFAULTS.cornerStyle,
    launcher: {
      iconUrl: launcherUser.iconUrl ?? launcherFetched.iconUrl,
      label: launcherUser.label ?? launcherFetched.label,
      showOnlineDot:
        launcherUser.showOnlineDot ?? launcherFetched.showOnlineDot ?? false,
    },
    colorScheme: userConfig.colorScheme ?? DEFAULTS.colorScheme,
    offset: {
      bottom: clampInt(offsetUser.bottom, 0, 1000, DEFAULTS.offsetBottom),
      side: clampInt(offsetUser.side, 0, 1000, DEFAULTS.offsetSide),
    },
    zIndex: clampInt(userConfig.zIndex, 0, 2_000_000_000, DEFAULTS.zIndex),
    // Defaults to true — the widget shows the attach button unless the
    // chatbot explicitly opts out via widget_config or the host passes
    // allowAttachments=false. Server still enforces the same flag at the
    // upload endpoint either way.
    allowAttachments:
      userConfig.allowAttachments ?? fetched?.allowAttachments ?? true,
  };
}

// Defensive parse of the incident-banner field on the public widget config
// payload. The server already validates, but a stale CDN cache or a future
// schema bump could deliver a partial shape; we'd rather drop the banner than
// throw inside the widget render. Also re-checks `expiresAt` so a long-cached
// payload doesn't keep showing a stale outage notice past the operator ETA.
function sanitizeIncidentBanner(input: unknown): IncidentBanner | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const sev = raw.severity;
  if (sev !== "info" && sev !== "warning" && sev !== "outage") return null;
  if (typeof raw.title !== "string" || raw.title.length === 0) return null;
  if (typeof raw.expiresAt === "string") {
    const t = Date.parse(raw.expiresAt);
    if (!Number.isNaN(t) && t <= Date.now()) return null;
  }
  const out: IncidentBanner = { severity: sev, title: raw.title };
  if (typeof raw.body === "string") out.body = raw.body;
  if (typeof raw.eta === "string") out.eta = raw.eta;
  if (raw.link && typeof raw.link === "object") {
    const link = raw.link as Record<string, unknown>;
    if (typeof link.url === "string") {
      out.link = { url: link.url };
      if (typeof link.label === "string") out.link.label = link.label;
    }
  }
  if (typeof raw.expiresAt === "string") out.expiresAt = raw.expiresAt;
  return out;
}

// Stable identity for an incident banner, used to detect content changes so
// a freshly edited banner reappears after a prior dismissal.
function bannerKey(banner: IncidentBanner | null): string | null {
  if (!banner) return null;
  return JSON.stringify([
    banner.severity,
    banner.title,
    banner.body ?? "",
    banner.eta ?? "",
    banner.link?.url ?? "",
    banner.link?.label ?? "",
    banner.expiresAt ?? "",
  ]);
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage)
      return window.localStorage;
    // SSR-safe fallback: some environments expose localStorage on globalThis
    // (e.g. test stubs, edge runtimes) without a `window` global.
    if (typeof globalThis !== "undefined") {
      const ls = (globalThis as { localStorage?: Storage }).localStorage;
      if (ls) return ls;
    }
    return null;
  } catch {
    return null;
  }
}

export class CustomerHeroChat {
  private state: ChatState;
  private listeners = new Set<Listener>();
  private storage: Storage | null;
  private userConfig: CustomerHeroChatConfig;
  private identityData: IdentityData | null = null;
  // `t` is mutable: it gets rebuilt when locale changes or when the fetched
  // widget config delivers `stringOverrides`. The React layer reads this
  // property directly each render rather than caching it in a state snapshot,
  // so a `setLocale` call propagates through `useSyncExternalStore` via the
  // accompanying `setState({ locale, isRtl })` notification.
  t: TranslateFn;

  constructor(config: CustomerHeroChatConfig) {
    this.userConfig = config;
    this.storage = getStorage();

    const locale = detectLocale(config.locale);
    const resolved = resolveConfig(config);
    this.t = createTranslator(locale, resolved.stringOverrides);

    const storedConvId = this.storage?.getItem(`ch_conv_${config.chatbotId}`);

    this.state = {
      messages: [],
      isOpen: false,
      isLoading: false,
      conversationId: storedConvId ?? null,
      config: resolved,
      configLoaded: false,
      configError: null,
      error: null,
      identity: null,
      locale,
      isRtl: isRtlLocale(locale),
      triggers: [],
      preChatForm: null,
      preChatFormVisible: false,
      preChatSubmission: null,
      consent: this.readStoredConsent(),
      pendingTriggerId: null,
      pendingPrefill: null,
      incidentBanner: null,
      incidentBannerDismissed: false,
      readOnly: false,
    };
  }

  /**
   * Mark the config as loaded and put the client into read-only preview
   * mode without hitting the API. Used by `@customerhero/react/preview` to
   * render the widget against a host-supplied config (the dashboard preview
   * pane). Public API consumers should not call this.
   *
   * Pass a config to re-resolve and update the rendered colors/size/launcher
   * in place. Callers should reuse the same client instance across config
   * changes so the open animation only fires once.
   *
   * @internal
   */
  __seedForPreview(
    config?: CustomerHeroChatConfig,
    extras?: { banner?: IncidentBanner | null },
  ): void {
    const resolved = config ? resolveConfig(config) : this.state.config;
    if (config) this.userConfig = config;
    // In preview mode there are never real conversations, so the message
    // list mirrors the welcome message verbatim. Re-seed on every call so
    // edits to the welcome text in the dashboard show up live.
    const seededMessages: ChatMessage[] = resolved.welcomeMessage
      ? [{ role: "bot" as const, content: resolved.welcomeMessage }]
      : [];
    const sanitizedBanner =
      extras && "banner" in extras
        ? sanitizeIncidentBanner(extras.banner ?? null)
        : this.state.incidentBanner;
    this.setState({
      config: resolved,
      configLoaded: true,
      configError: null,
      readOnly: true,
      isOpen: true,
      messages: seededMessages,
      incidentBanner: sanitizedBanner,
      // Reset the dismissed flag so toggling the banner on in the dashboard
      // re-renders it after a previous preview-side dismiss.
      incidentBannerDismissed: false,
    });
  }

  // ── Proactive engagement state ─────────────────────────────────────
  private triggersRuntime: TriggersRuntimeHandle | null = null;
  private preChatFormSubmitted = false;

  private readStoredConsent(): ConsentSettings {
    try {
      const raw = this.storage?.getItem("ch_consent");
      if (!raw) return { analytics: false };
      const parsed = JSON.parse(raw) as { analytics?: unknown };
      return { analytics: parsed.analytics === true };
    } catch {
      return { analytics: false };
    }
  }

  private writeStoredConsent(consent: ConsentSettings): void {
    try {
      this.storage?.setItem("ch_consent", JSON.stringify(consent));
    } catch {
      // best-effort
    }
  }

  // Switch the active locale at runtime. No-op when the resolved tag matches
  // the current locale and `stringOverrides` is unchanged. Subscribers get a
  // single state notification with the new `locale` / `isRtl`.
  setLocale(tag: string): void {
    const next = detectLocale(tag);
    if (next === this.state.locale) return;
    this.t = createTranslator(next, this.state.config.stringOverrides);
    this.setState({ locale: next, isRtl: isRtlLocale(next) });
  }

  private rebuildTranslator(): void {
    this.t = createTranslator(
      this.state.locale,
      this.state.config.stringOverrides,
    );
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): ChatState {
    return this.state;
  }

  private setState(partial: Partial<ChatState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  // Mutate the last message in place and notify. Used during streaming so
  // listeners see tokens land without allocating a new messages array per
  // token. The array itself is still replaced so consumers using
  // structural equality (React's useSyncExternalStore) see a new reference.
  private patchLastMessage(patch: Partial<ChatMessage>): void {
    const { messages } = this.state;
    if (messages.length === 0) return;
    const next = messages.slice();
    const last = next[next.length - 1];
    next[next.length - 1] = { ...last, ...patch };
    this.setState({ messages: next });
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  async fetchConfig(): Promise<void> {
    const { chatbotId } = this.userConfig;
    const apiBase = this.userConfig.apiBase ?? DEFAULTS.apiBase;

    try {
      const response = await fetch(`${apiBase}/api/widget/${chatbotId}/config`);
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }
      const fetched = (await response.json()) as Partial<ResolvedConfig> & {
        triggers?: TriggerDefinition[];
        preChatForm?: PreChatFormConfig;
        incidentBanner?: IncidentBanner | null;
      };
      const resolved = resolveConfig(this.userConfig, fetched);
      const triggers = Array.isArray(fetched.triggers) ? fetched.triggers : [];
      const preChatForm = fetched.preChatForm ?? null;
      const incidentBanner = sanitizeIncidentBanner(fetched.incidentBanner);
      // Banner content changed → reset visitor's dismissed flag so the new
      // notice is visible. We compare a stable serialization rather than
      // identity since the banner is reconstructed each fetch.
      const prevBannerKey = bannerKey(this.state.incidentBanner);
      const nextBannerKey = bannerKey(incidentBanner);
      const dismissedFromStorage =
        nextBannerKey && nextBannerKey === this.readStoredBannerDismissal();
      const incidentBannerDismissed =
        nextBannerKey === prevBannerKey
          ? this.state.incidentBannerDismissed || !!dismissedFromStorage
          : !!dismissedFromStorage;
      this.setState({
        config: resolved,
        configLoaded: true,
        triggers,
        preChatForm,
        incidentBanner,
        incidentBannerDismissed,
      });
      // Server-delivered string overrides require rebuilding the translator
      // so subsequent `t()` calls pick them up.
      if (resolved.stringOverrides) this.rebuildTranslator();
      this.startTriggersRuntimeIfPossible();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to load widget config";
      console.error("CustomerHero: Failed to fetch widget config", error);
      this.setState({
        configLoaded: true,
        configError: errorMsg,
      });
      return;
    }

    // Load previous conversation history if we have a stored conversationId
    if (this.state.conversationId) {
      await this.loadHistory();
    }
  }

  private async loadHistory(): Promise<void> {
    const { chatbotId, apiBase } = this.state.config;
    const { conversationId } = this.state;
    if (!conversationId) return;

    // C3: present the transcript-read capability token (issued with each
    // chat reply) as the `t` query param so the server authorizes the read.
    // Use the query param, NOT a header — the messages endpoint's CORS
    // preflight only allows Content-Type/Accept, so a custom request header
    // would be blocked cross-origin.
    const readToken = this.storage?.getItem(`ch_conv_token_${chatbotId}`);
    const messagesUrl = `${apiBase}/api/chat/${chatbotId}/messages/${conversationId}`;

    try {
      const response = await fetch(
        readToken
          ? `${messagesUrl}?t=${encodeURIComponent(readToken)}`
          : messagesUrl,
      );
      if (!response.ok) {
        // Conversation was deleted, or the read token is invalid/expired
        // (403). Either way, clear it and start fresh.
        this.storage?.removeItem(`ch_conv_${chatbotId}`);
        this.storage?.removeItem(`ch_conv_token_${chatbotId}`);
        this.setState({ conversationId: null });
        return;
      }
      const data = (await response.json()) as {
        messages?: Array<{
          id?: string;
          role: string;
          content: string;
          sources?: MessageSource[];
          blocks?: MessageBlock[];
          suggestions?: string[];
          attachments?: MessageAttachment[];
        }>;
      };
      const raw = data.messages ?? [];
      const messages: ChatMessage[] = raw.map((m) => ({
        id: m.id,
        role: m.role as "user" | "bot",
        content: m.content,
        ...(m.sources ? { sources: m.sources } : {}),
        ...(m.blocks ? { blocks: m.blocks } : {}),
        ...(m.suggestions ? { suggestions: m.suggestions } : {}),
        ...(m.attachments?.length ? { attachments: m.attachments } : {}),
      }));

      // Only keep follow-up suggestions on the most recent bot message — older
      // suggestions are stale once the conversation has moved on.
      const lastBotIndex = findLastIndex(
        messages,
        (m) => m.role === "bot" && !!m.suggestions?.length,
      );
      for (let i = 0; i < messages.length; i++) {
        if (i !== lastBotIndex && messages[i].suggestions) {
          const { suggestions: _s, ...rest } = messages[i];
          void _s;
          messages[i] = rest;
        }
      }

      if (messages.length > 0) {
        this.setState({ messages });
      }
    } catch {
      // Silently fail — user can still chat, just won't see history
    }
  }

  async sendMessage(
    message: string,
    options?: { attachmentTokens?: string[] },
  ): Promise<void> {
    // Read-only / preview mode: never hit the API. Used by the dashboard
    // preview pane so that an operator typing in the previewed input doesn't
    // create real conversations against their own chatbot.
    if (this.state.readOnly) return;
    const trimmed = message.trim();
    const attachmentTokens = options?.attachmentTokens ?? [];
    // Attachments-only sends are not supported (the server requires text).
    if (!trimmed || this.state.isLoading) return;

    // Pre-chat form gate: when a form is configured and not yet submitted,
    // suspend the send and surface the form. The host (React shell or
    // integrator) must call `submitPreChatForm()` to resume — the message
    // text is preserved in `pendingMessage` so we can re-send after the
    // submission completes.
    if (this.shouldShowPreChatForm()) {
      this.pendingMessageAfterPreChat = {
        message: trimmed,
        attachmentTokens,
      };
      this.setState({ preChatFormVisible: true });
      return;
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      status: "sending",
    };
    // Drop any stale follow-up suggestions from the previous bot turn — the
    // customer just sent a new message, the old chips no longer apply.
    // Also supersede any open action_confirmation card optimistically: the
    // server will authoritatively supersede the pending row, but stripping
    // the block locally now keeps the UI from flashing a stale card while
    // the request is in flight.
    const cleanedHistory = this.state.messages.map((m) => {
      let next = m;
      if (next.suggestions) next = stripSuggestions(next);
      if (next.blocks?.some((b) => b.type === "action_confirmation")) {
        next = stripActionConfirmationBlocks(next);
      }
      return next;
    });
    const userMsgIndex = cleanedHistory.length;
    this.setState({
      messages: [...cleanedHistory, userMsg],
      isLoading: true,
      error: null,
    });

    const { chatbotId, apiBase } = this.state.config;
    let botMessageCreated = false;

    try {
      const response = await fetch(`${apiBase}/api/chat/${chatbotId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: trimmed,
          ...(this.state.conversationId
            ? { conversationId: this.state.conversationId }
            : {}),
          ...(this.identityData ? { identity: this.identityData } : {}),
          ...(attachmentTokens.length > 0 ? { attachmentTokens } : {}),
          // Trigger attribution + pre-chat submission only land on the very
          // first turn. We only consume them when there's no conversationId
          // yet — the server ignores them on subsequent turns anyway, but
          // sending them again would be misleading.
          ...(!this.state.conversationId && this.state.pendingTriggerId
            ? { triggeredByTriggerId: this.state.pendingTriggerId }
            : {}),
          ...(!this.state.conversationId && this.state.preChatSubmission
            ? { prechatSubmission: this.state.preChatSubmission }
            : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMsg =
          (data as { error?: string } | null)?.error ??
          `Request failed: ${response.status}`;
        throw new Error(errorMsg);
      }

      if (!response.body) {
        throw new Error("Empty response body");
      }

      // Server has accepted the request — flip the user bubble to sent now.
      // We don't wait for the SSE `metadata` event because `prepareChat` on
      // the server (retrieval, history load, etc.) can take seconds before
      // it yields, which would otherwise leave the bubble on "Sending" for
      // the entire pre-LLM phase.
      this.patchMessageAt(userMsgIndex, { status: "sent" });

      let fullContent = "";
      let messageId: string | undefined;

      for await (const evt of readSSEStream(response.body)) {
        switch (evt.event) {
          case "metadata": {
            const meta = safeParse<{
              conversationId?: string;
              messageId?: string;
            }>(evt.data);
            if (meta?.conversationId) {
              this.storage?.setItem(
                `ch_conv_${chatbotId}`,
                meta.conversationId,
              );
              // Conversation has been created — `triggeredByTriggerId` and
              // `prechatSubmission` are now committed server-side, so we can
              // clear them from local state to avoid a redundant re-send if
              // the user reloads the SDK and types again before the
              // conversation is loaded from history.
              this.setState({
                conversationId: meta.conversationId,
                pendingTriggerId: null,
                preChatSubmission: null,
              });
            }
            if (meta?.messageId) {
              messageId = meta.messageId;
            }
            break;
          }
          case "read-token": {
            // C3: store the transcript-read capability token next to the
            // conversationId so a later reload can authorize loading
            // history. Re-issued on every reply, so always overwrite.
            const tok = safeParse<{ readToken?: string }>(evt.data);
            if (tok?.readToken) {
              this.storage?.setItem(
                `ch_conv_token_${chatbotId}`,
                tok.readToken,
              );
            }
            break;
          }
          case "token": {
            const tok = safeParse<{ text?: string }>(evt.data);
            const text = tok?.text ?? "";
            fullContent += text;
            if (!botMessageCreated) {
              const botMsg: ChatMessage = {
                id: messageId,
                role: "bot",
                content: fullContent,
                streaming: true,
              };
              this.setState({
                messages: [...this.state.messages, botMsg],
              });
              botMessageCreated = true;
            } else {
              this.patchLastMessage({ content: fullContent });
            }
            break;
          }
          case "sources": {
            const payload = safeParse<{ sources?: MessageSource[] }>(evt.data);
            if (payload?.sources?.length && botMessageCreated) {
              this.patchLastMessage({ sources: payload.sources });
            }
            break;
          }
          case "block": {
            const payload = safeParse<{ block?: MessageBlock }>(evt.data);
            if (payload?.block && botMessageCreated) {
              const existing = this.state.messages.at(-1)?.blocks ?? [];
              this.patchLastMessage({
                blocks: [...existing, payload.block],
              });
            }
            break;
          }
          case "suggestions": {
            const payload = safeParse<{ suggestions?: string[] }>(evt.data);
            if (payload?.suggestions?.length && botMessageCreated) {
              this.patchLastMessage({ suggestions: payload.suggestions });
            }
            break;
          }
          case "done": {
            if (botMessageCreated) {
              this.patchLastMessage({
                id: messageId,
                streaming: false,
              });
            }
            break;
          }
          case "error": {
            const payload = safeParse<{ error?: string }>(evt.data);
            throw new Error(payload?.error ?? "Stream failed");
          }
        }
      }

      // If we finished the stream without any tokens (e.g. manual response
      // mode), surface a neutral empty state rather than a ghost bubble.
      if (!botMessageCreated && !fullContent) {
        // Nothing to render — the server is deferring to a human agent.
      }

      this.setState({ isLoading: false });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Something went wrong";
      // If a partial bot message was rendered, drop its streaming flag so it
      // stops looking like it's still loading.
      if (botMessageCreated) {
        this.patchLastMessage({ streaming: false });
      }
      // The user bubble stays visible so the customer can retry. If we
      // already saw `metadata` (status: sent), don't downgrade to failed —
      // the server *did* accept the message, the failure was mid-stream.
      const userStatus = this.state.messages[userMsgIndex]?.status;
      if (userStatus !== "sent") {
        this.patchMessageAt(userMsgIndex, { status: "failed" });
      }
      this.setState({
        isLoading: false,
        error: errorMsg,
      });
    }
  }

  // Upload a screenshot blob to the public attachments endpoint and return
  // the token the caller should pass to `sendMessage(text, { attachmentTokens })`.
  async uploadAttachment(
    blob: Blob,
    options?: { filename?: string },
  ): Promise<{
    attachmentToken: string;
    previewUrl: string;
    expiresAt: string;
  }> {
    const { chatbotId, apiBase } = this.state.config;
    const filename =
      options?.filename ?? `screenshot.${pickExtension(blob.type)}`;
    const form = new FormData();
    form.append("file", blob, filename);

    const response = await fetch(
      `${apiBase}/api/chat/${chatbotId}/attachments`,
      { method: "POST", body: form },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const errorMsg =
        (data as { error?: string } | null)?.error ??
        `Upload failed: ${response.status}`;
      throw new Error(errorMsg);
    }
    const json = (await response.json()) as {
      attachmentToken: string;
      previewUrl: string;
      expiresAt: string;
    };
    return json;
  }

  approveAction(pendingId: string): Promise<void> {
    return this.sendDecision(pendingId, "approve");
  }

  cancelAction(pendingId: string): Promise<void> {
    return this.sendDecision(pendingId, "cancel");
  }

  // Locate the bot bubble that carries the action_confirmation block for
  // `pendingId`, strip the block, mark the bubble streaming, then POST the
  // decision and stream tokens back into the same bubble.
  private async sendDecision(
    pendingId: string,
    decision: "approve" | "cancel",
  ): Promise<void> {
    const targetIndex = this.findActionConfirmationMessageIndex(pendingId);
    if (targetIndex === -1) {
      // The card is gone — likely already resolved on another tab. Surface a
      // localized error and re-fetch history to converge on the server state.
      this.setState({ error: this.t("action_already_resolved") });
      await this.loadHistory();
      return;
    }

    // Resolve the decision endpoint from the block itself. The API ships
    // `approveHref` / `cancelHref` per card so the same confirmation UI can
    // back either an LLM tool call (`/tool-calls/:id/decision`) or a workflow
    // approval node (`/workflow-approvals/:id/decision`). Honoring the href
    // keeps the SDK forward-compatible with future decision routes; we fall
    // back to the legacy tool-call path for older API responses that predate
    // the href fields.
    const decisionBlock = this.state.messages[targetIndex].blocks?.find(
      (b): b is Extract<MessageBlock, { type: "action_confirmation" }> =>
        b.type === "action_confirmation" && b.pendingToolCallId === pendingId,
    );

    // Optimistically strip the card and start streaming on that bubble.
    const messages = this.state.messages.slice();
    const original = messages[targetIndex];
    messages[targetIndex] = {
      ...stripActionConfirmationBlocks(original),
      streaming: true,
    };
    this.setState({ messages, error: null });

    const { chatbotId, apiBase } = this.state.config;
    const href =
      decision === "approve"
        ? decisionBlock?.approveHref
        : decisionBlock?.cancelHref;
    const url = href
      ? `${apiBase}${href}`
      : `${apiBase}/api/chat/${chatbotId}/tool-calls/${pendingId}/decision`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          decision,
          ...(this.identityData ? { identity: this.identityData } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMsg =
          (data as { error?: string } | null)?.error ??
          `Request failed: ${response.status}`;
        throw new Error(errorMsg);
      }
      if (!response.body) throw new Error("Empty response body");

      for await (const evt of readSSEStream(response.body)) {
        switch (evt.event) {
          case "metadata": {
            const meta = safeParse<{ conversationId?: string }>(evt.data);
            if (meta?.conversationId) {
              this.storage?.setItem(
                `ch_conv_${chatbotId}`,
                meta.conversationId,
              );
              this.setState({ conversationId: meta.conversationId });
            }
            break;
          }
          case "read-token": {
            // C3: persist the transcript-read token (see the metadata
            // handler in sendMessage for details).
            const tok = safeParse<{ readToken?: string }>(evt.data);
            if (tok?.readToken) {
              this.storage?.setItem(
                `ch_conv_token_${chatbotId}`,
                tok.readToken,
              );
            }
            break;
          }
          case "token": {
            const tok = safeParse<{ text?: string }>(evt.data);
            const text = tok?.text ?? "";
            if (text) {
              this.appendToMessageAt(targetIndex, text);
            }
            break;
          }
          case "block": {
            const payload = safeParse<{ block?: MessageBlock }>(evt.data);
            if (payload?.block) {
              this.appendBlockToMessageAt(targetIndex, payload.block);
            }
            break;
          }
          case "done": {
            this.patchMessageAt(targetIndex, { streaming: false });
            break;
          }
          case "error": {
            const payload = safeParse<{ error?: string; kind?: string }>(
              evt.data,
            );
            if (payload?.kind === "already_resolved") {
              this.patchMessageAt(targetIndex, { streaming: false });
              this.setState({ error: this.t("action_already_resolved") });
              await this.loadHistory();
              return;
            }
            throw new Error(payload?.error ?? "Stream failed");
          }
        }
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : this.t("action_failed");
      this.patchMessageAt(targetIndex, { streaming: false });
      this.setState({ error: errorMsg });
    }
  }

  private findActionConfirmationMessageIndex(pendingId: string): number {
    const { messages } = this.state;
    for (let i = messages.length - 1; i >= 0; i--) {
      const blocks = messages[i].blocks;
      if (
        blocks?.some(
          (b) =>
            b.type === "action_confirmation" &&
            b.pendingToolCallId === pendingId,
        )
      ) {
        return i;
      }
    }
    return -1;
  }

  private patchMessageAt(index: number, patch: Partial<ChatMessage>): void {
    const messages = this.state.messages.slice();
    if (!messages[index]) return;
    messages[index] = { ...messages[index], ...patch };
    this.setState({ messages });
  }

  private appendToMessageAt(index: number, text: string): void {
    const messages = this.state.messages.slice();
    const target = messages[index];
    if (!target) return;
    messages[index] = { ...target, content: target.content + text };
    this.setState({ messages });
  }

  private appendBlockToMessageAt(index: number, block: MessageBlock): void {
    const messages = this.state.messages.slice();
    const target = messages[index];
    if (!target) return;
    const existing = target.blocks ?? [];
    messages[index] = { ...target, blocks: [...existing, block] };
    this.setState({ messages });
  }

  async rateMessage(messageId: string, rating: MessageRating): Promise<void> {
    const { chatbotId, apiBase } = this.state.config;
    const { conversationId } = this.state;
    if (!conversationId) return;

    try {
      await fetch(`${apiBase}/api/chat/${chatbotId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, messageId, rating }),
      });
    } catch (error) {
      console.error("CustomerHero: Failed to rate message", error);
    }
  }

  toggle(): void {
    const willOpen = !this.state.isOpen;
    if (
      willOpen &&
      this.state.messages.length === 0 &&
      !this.state.conversationId &&
      this.state.config.welcomeMessage
    ) {
      this.setState({
        isOpen: true,
        messages: [{ role: "bot", content: this.state.config.welcomeMessage }],
      });
    } else {
      this.setState({ isOpen: willOpen });
    }
  }

  open(): void {
    if (!this.state.isOpen) this.toggle();
  }

  close(): void {
    if (this.state.isOpen) this.setState({ isOpen: false });
  }

  reset(): void {
    const { chatbotId, welcomeMessage } = this.state.config;
    this.storage?.removeItem(`ch_conv_${chatbotId}`);
    this.storage?.removeItem(`ch_conv_token_${chatbotId}`);
    this.setState({
      messages: welcomeMessage
        ? [{ role: "bot", content: welcomeMessage }]
        : [],
      conversationId: null,
      isLoading: false,
      error: null,
    });
  }

  // ── Proactive engagement public API ────────────────────────────────

  /** Update visitor consent. Until `analytics: true` is set, only direct
   *  launcher clicks fire — URL/time/scroll/exit-intent/trait conditions
   *  stay dormant. The setting is persisted in localStorage so revisits
   *  don't re-prompt. */
  setConsent(consent: Partial<ConsentSettings>): void {
    const next: ConsentSettings = {
      analytics:
        typeof consent.analytics === "boolean"
          ? consent.analytics
          : this.state.consent.analytics,
    };
    this.writeStoredConsent(next);
    this.setState({ consent: next });
    // If consent just turned on, the runtime can re-evaluate and fire any
    // currently-matching trigger.
    this.triggersRuntime?.reevaluate();
  }

  /** Set or update visitor traits used by trait-based conditions. The trait
   *  values are kept in memory (not persisted) so the integrator decides
   *  the source of truth. */
  setTraits(traits: Record<string, string | number | boolean>): void {
    this.triggersRuntime?.setTraits(traits);
  }

  /** Hide the active incident banner for this visitor. Persisted in
   *  localStorage so a refresh keeps it dismissed; resets automatically
   *  when the operator changes the banner content. No-op when no banner
   *  is showing. */
  dismissIncidentBanner(): void {
    const key = bannerKey(this.state.incidentBanner);
    if (!key) return;
    this.writeStoredBannerDismissal(key);
    this.setState({ incidentBannerDismissed: true });
  }

  private readStoredBannerDismissal(): string | null {
    try {
      return (
        this.storage?.getItem(
          `ch_incident_dismissed_${this.userConfig.chatbotId}`,
        ) ?? null
      );
    } catch {
      return null;
    }
  }

  private writeStoredBannerDismissal(key: string): void {
    try {
      this.storage?.setItem(
        `ch_incident_dismissed_${this.userConfig.chatbotId}`,
        key,
      );
    } catch {
      // best-effort
    }
  }

  /** Submit pre-chat form answers. Synthesizes a customer record server-side
   *  on the next sendMessage. Resumes any pending message that was deferred
   *  while the form was open. */
  async submitPreChatForm(submission: PreChatSubmission): Promise<void> {
    this.preChatFormSubmitted = true;
    this.setState({
      preChatSubmission: submission,
      preChatFormVisible: false,
    });
    const pending = this.pendingMessageAfterPreChat;
    this.pendingMessageAfterPreChat = null;
    if (pending) {
      await this.sendMessage(pending.message, {
        attachmentTokens: pending.attachmentTokens,
      });
    }
  }

  /** Dismiss the pre-chat form without submitting. The form will reappear
   *  on the next sendMessage attempt — call `setConsent` to acknowledge a
   *  refusal, or `reset()` to clear pending state. */
  cancelPreChatForm(): void {
    this.pendingMessageAfterPreChat = null;
    this.setState({ preChatFormVisible: false });
  }

  /** Programmatically dispatch the action attached to a trigger. Used by
   *  integrators who want to act on a custom button, e.g. an exit-intent
   *  modal in their own UI. */
  fireTrigger(triggerId: string): void {
    const trigger = this.state.triggers.find((t) => t.id === triggerId);
    if (!trigger) return;
    this.triggersRuntime?.markFired(trigger.id, trigger.frequency);
    this.handleTriggerAction(trigger);
  }

  // ── Internals ──────────────────────────────────────────────────────

  private pendingMessageAfterPreChat: {
    message: string;
    attachmentTokens: string[];
  } | null = null;

  private shouldShowPreChatForm(): boolean {
    const form = this.state.preChatForm;
    if (!form) return false;
    if (this.preChatFormSubmitted) return false;
    if (this.state.conversationId) return false;
    if (form.skipForIdentified && this.identityData?.userId) return false;
    return true;
  }

  private startTriggersRuntimeIfPossible(): void {
    if (this.triggersRuntime) return;
    if (this.state.triggers.length === 0) return;
    this.triggersRuntime = startTriggersRuntime({
      chatbotId: this.state.config.chatbotId,
      triggers: this.state.triggers,
      isAllowedToFire: () => this.state.consent.analytics,
      onFire: (trigger) => this.handleTriggerAction(trigger),
    });
  }

  private handleTriggerAction(trigger: TriggerDefinition): void {
    // Record attribution for the next conversation start. Subsequent fires
    // overwrite this — the most recent trigger to fire is the one that gets
    // credit if multiple fire before the customer types.
    this.setState({ pendingTriggerId: trigger.id });
    const action = trigger.action as TriggerAction;
    switch (action.kind) {
      case "open_widget":
        this.open();
        break;
      case "open_with_prefill":
        this.open();
        this.setState({ pendingPrefill: action.prefill });
        break;
      case "show_form":
        this.open();
        if (this.state.preChatForm) {
          this.setState({ preChatFormVisible: true });
        }
        break;
      case "send_message":
        this.open();
        // Inject a bot bubble that introduces the conversation. The first
        // visitor reply will create the real conversation server-side and
        // attribute it via the pending trigger.
        if (this.state.messages.length === 0) {
          this.setState({
            messages: [{ role: "bot", content: action.message }],
          });
        }
        break;
    }
  }

  /** Read and clear the pending prefill (set by an `open_with_prefill`
   *  trigger). The host calls this once when mounting the input and seeds
   *  its controlled value with the result. */
  consumePendingPrefill(): string | null {
    const prefill = this.state.pendingPrefill;
    if (prefill !== null) this.setState({ pendingPrefill: null });
    return prefill;
  }

  /** Stop the triggers runtime and detach listeners. Safe to call multiple
   *  times; safe to call before the runtime started. */
  destroy(): void {
    this.triggersRuntime?.stop();
    this.triggersRuntime = null;
  }

  identify(payload: IdentifyPayload): void {
    const { userId, email, name, phone, company, userHash, ...rest } = payload;
    const customProperties: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        customProperties[k] = v;
      }
    }
    this.identityData = {
      userId,
      email,
      name,
      phone,
      company,
      userHash,
      customProperties:
        Object.keys(customProperties).length > 0 ? customProperties : undefined,
    };
    // When identity changes, clear old conversation to start fresh
    const { chatbotId, welcomeMessage } = this.state.config;
    this.storage?.removeItem(`ch_conv_${chatbotId}`);
    this.storage?.removeItem(`ch_conv_token_${chatbotId}`);
    this.setState({
      messages: welcomeMessage
        ? [{ role: "bot", content: welcomeMessage }]
        : [],
      conversationId: null,
      isLoading: false,
      error: null,
      identity: this.identityData,
    });
  }
}

function safeParse<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

function stripSuggestions(message: ChatMessage): ChatMessage {
  const { suggestions: _s, ...rest } = message;
  void _s;
  return rest;
}

function stripActionConfirmationBlocks(message: ChatMessage): ChatMessage {
  if (!message.blocks?.length) return message;
  const blocks = message.blocks.filter((b) => b.type !== "action_confirmation");
  if (blocks.length === message.blocks.length) return message;
  if (blocks.length === 0) {
    const { blocks: _b, ...rest } = message;
    void _b;
    return rest;
  }
  return { ...message, blocks };
}

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}

function pickExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}
