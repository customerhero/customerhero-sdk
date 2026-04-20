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
}

export function CustomerHeroProvider({
  children,
  ...config
}: CustomerHeroProviderProps) {
  const clientRef = useRef<CustomerHeroChat | null>(null);

  if (!clientRef.current) {
    clientRef.current = new CustomerHeroChat(config);
  }

  useEffect(() => {
    clientRef.current?.fetchConfig();
  }, []);

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
