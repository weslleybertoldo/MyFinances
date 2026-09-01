import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle as capacitorSignIn } from "@/lib/capacitorAuth";

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
      // Upsert por (user_id, name): esta funcao roda em 3 gatilhos de login que correm
      // entre si — com insert puro, os 3 liam count=0 e cada um inseria as 10 categorias
      // padrao (30 no total). O indice unico + ignoreDuplicates torna a corrida inocua.
      await supabase.from("categories").upsert(
        DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId })),
        { onConflict: "user_id,name", ignoreDuplicates: true }
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
    // Sessao inicial
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

      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        const email = session.user.email?.toLowerCase();
        if (email !== ALLOWED_EMAIL) {
          signingOut.current = true;
          // scope local pelo mesmo motivo do signOut manual: nao derrubar a sessao
          // desse usuario em outro app do mesmo Supabase (RLS ja barra os dados aqui).
          supabase.auth.signOut({ scope: "local" }).then(() => {
            signingOut.current = false;
          }).catch(() => {
            signingOut.current = false;
          });
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        setSession(session);
        setUser(session.user);
        setLoading(false);
        seedCategories(session.user.id);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setSession(session);
        setUser(session.user);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    const result = await capacitorSignIn();
    if (result.error) {
      return { error: result.error };
    }
    // Deep link flow: setSession ja foi chamado no capacitorAuth
    // onAuthStateChange vai atualizar user/session
    // Forcar refresh para garantir
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const email = session.user.email?.toLowerCase();
      if (email === ALLOWED_EMAIL) {
        setSession(session);
        setUser(session.user);
        seedCategories(session.user.id);
      }
    }
    return { error: null };
  };

  const signOut = async () => {
    signingOut.current = true;
    try {
      // scope local: o Supabase e compartilhado com o Painel de Controle — signOut
      // global revogaria a sessao do outro app tambem.
      await supabase.auth.signOut({ scope: "local" });
    } catch (e) {
      console.warn("[Auth] Erro ao fazer signOut:", e);
    } finally {
      signingOut.current = false;
      setSession(null);
      setUser(null);
    }
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
