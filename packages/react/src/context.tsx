import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  CustomerHeroChat,
  type CustomerHeroChatConfig,
} from "@customerhero/js";

const CustomerHeroContext = createContext<CustomerHeroChat | null>(null);

export interface CustomerHeroProviderProps extends CustomerHeroChatConfig {
  children: ReactNode;
  /**
   * When true, the provider does NOT call `client.fetchConfig()` on mount.
   * Used by the preview subpath to render the widget against a host-supplied
   * config. Public consumers should leave this unset.
   *
   * @internal
   */
  disableAutoFetch?: boolean;
}

export function CustomerHeroProvider({
  children,
  disableAutoFetch,
  ...config
}: CustomerHeroProviderProps) {
  const clientRef = useRef<CustomerHeroChat | null>(null);

  if (!clientRef.current) {
    clientRef.current = new CustomerHeroChat(config);
  }

  useEffect(() => {
    if (disableAutoFetch) return;
    clientRef.current?.fetchConfig();
  }, [disableAutoFetch]);

  return (
    <CustomerHeroContext.Provider value={clientRef.current}>
      {children}
    </CustomerHeroContext.Provider>
  );
}

export function useCustomerHeroClient(): CustomerHeroChat {
  const client = useContext(CustomerHeroContext);
  if (!client) {
    throw new Error(
      "useCustomerHeroClient must be used within a <CustomerHeroProvider>",
    );
  }
  return client;
}
