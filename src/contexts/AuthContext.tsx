import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle as capacitorSignIn } from "@/lib/capacitorAuth";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

const ALLOWED_EMAIL = "weslleybertoldo18@gmail.com";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_CATEGORIES = [
  { name: "Alimentação", color: "#F97316", type: "expense" as const },
  { name: "Transporte", color: "#3B82F6", type: "expense" as const },
  { name: "Moradia", color: "#22C55E", type: "expense" as const },
  { name: "Saúde", color: "#EF4444", type: "expense" as const },
  { name: "Educação", color: "#A855F7", type: "expense" as const },
  { name: "Lazer", color: "#EC4899", type: "expense" as const },
  { name: "Salário", color: "#16A34A", type: "income" as const },
  { name: "Freelance", color: "#06B6D4", type: "income" as const },
  { name: "Investimentos", color: "#EAB308", type: "both" as const },
  { name: "Outros", color: "#6B7280", type: "both" as const },
];

async function seedCategories(userId: string) {
  try {
    const { count } = await supabase
      .from("categories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (count === 0) {
      await supabase.from("categories").insert(
        DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }))
      );
    }
  } catch (e) {
    console.warn("[Auth] Erro ao seed categorias:", e);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const signingOut = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Listener Capacitor — verificar sessão quando app volta ao foreground
    let capListener: { remove: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      capListener = CapApp.addListener("appStateChange", async ({ isActive }) => {
        try {
          if (isActive && !user) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              const email = session.user.email?.toLowerCase();
              if (email === ALLOWED_EMAIL) {
                setSession(session);
                setUser(session.user);
                seedCategories(session.user.id);
              }
            }
          }
        } catch (e) {
          console.warn("[Auth] Erro ao verificar sessão no foreground:", e);
        }
      });
    }

    // Sessão inicial
    if (!initializedRef.current) {
      initializedRef.current = true;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const email = session.user.email?.toLowerCase();
          if (email === ALLOWED_EMAIL) {
            setSession(session);
            setUser(session.user);
            seedCategories(session.user.id);
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    }

    // Listener de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (signingOut.current) return;

      if (event === "SIGNED_IN" && session?.user) {
        const email = session.user.email?.toLowerCase();
        if (email !== ALLOWED_EMAIL) {
          signingOut.current = true;
          supabase.auth.signOut().then(() => {
            signingOut.current = false;
          }).catch(() => {
            signingOut.current = false;
          });
          setSession(null);
          setUser(null);
          return;
        }
        setSession(session);
        setUser(session.user);
        seedCategories(session.user.id);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setSession(session);
        setUser(session.user);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (capListener) capListener.remove();
    };
  }, []);

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    const result = await capacitorSignIn();
    return { error: result.error ?? null };
  };

  const signOut = async () => {
    signingOut.current = true;
    await supabase.auth.signOut();
    signingOut.current = false;
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
