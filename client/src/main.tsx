import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { SimpleAuthProvider } from "./contexts/SimpleAuthContext";
import "./index.css";

const STORAGE_KEY = 'pptmaster_user';
const TOKEN_KEY = 'pptmaster_token';

// Get auth info from localStorage
function getStoredAuth(): { user: { name: string; openId: string } | null; token: string | null } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    return {
      user: stored ? JSON.parse(stored) : null,
      token,
    };
  } catch (e) {
    return { user: null, token: null };
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000, // 30 seconds
    },
    mutations: {
      retry: 1,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const { user, token } = getStoredAuth();
        const headers: Record<string, string> = {};
        
        // Prefer JWT token
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Also send legacy headers for backward compatibility
        if (user) {
          headers['x-username'] = encodeURIComponent(user.name);
          headers['x-user-openid'] = encodeURIComponent(user.openId);
        }
        
        return headers;
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <SimpleAuthProvider>
        <App />
      </SimpleAuthProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
