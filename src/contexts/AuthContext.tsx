import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
  const { count } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count === 0) {
    await supabase.from("categories").insert(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }))
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSession = async (session: Session | null) => {
    if (session?.user) {
      const email = session.user.email?.toLowerCase();
      if (email !== ALLOWED_EMAIL) {
        // Email não autorizado — faz logout
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        return;
      }
      setSession(session);
      setUser(session.user);
      seedCategories(session.user.id);
    } else {
      setSession(null);
      setUser(null);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
