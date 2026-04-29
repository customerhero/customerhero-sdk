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
  IdentifyPayload,
  IdentityData,
  TriggerDefinition,
  TriggerAction,
  PreChatFormConfig,
  PreChatSubmission,
  ConsentSettings,
} from "./types";

type Listener = (state: ChatState) => void;

function resolveConfig(
  userConfig: CustomerHeroChatConfig,
  fetched?: Partial<ResolvedConfig>,
): ResolvedConfig {
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
  };
}

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
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
    };
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
      };
      const resolved = resolveConfig(this.userConfig, fetched);
      const triggers = Array.isArray(fetched.triggers) ? fetched.triggers : [];
      const preChatForm = fetched.preChatForm ?? null;
      this.setState({
        config: resolved,
        configLoaded: true,
        triggers,
        preChatForm,
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

    try {
      const response = await fetch(
        `${apiBase}/api/chat/${chatbotId}/messages/${conversationId}`,
      );
      if (!response.ok) {
        // Conversation may have been deleted — clear it and start fresh
        this.storage?.removeItem(`ch_conv_${chatbotId}`);
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
            // Server has accepted the message — flip the user bubble to sent.
            this.patchMessageAt(userMsgIndex, { status: "sent" });
            if (meta?.messageId) {
              messageId = meta.messageId;
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

    // Optimistically strip the card and start streaming on that bubble.
    const messages = this.state.messages.slice();
    const original = messages[targetIndex];
    messages[targetIndex] = {
      ...stripActionConfirmationBlocks(original),
      streaming: true,
    };
    this.setState({ messages, error: null });

    const { chatbotId, apiBase } = this.state.config;
    const url = `${apiBase}/api/chat/${chatbotId}/tool-calls/${pendingId}/decision`;

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
