import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
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
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) seedCategories(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) seedCategories(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
