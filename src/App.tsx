import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Transactions = lazy(() => import("@/pages/Transactions"));
const FutureLaunches = lazy(() => import("@/pages/FutureLaunches"));
const Banks = lazy(() => import("@/pages/Banks"));
const Auth = lazy(() => import("@/pages/Auth"));
const Projects = lazy(() => import("@/pages/Projects"));
const Investments = lazy(() => import("@/pages/Investments"));
const CreditCardsPage = lazy(() => import("@/pages/CreditCards"));
const Settings = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const PageFallback = () => (
  <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">
    Carregando…
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 10,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ErrorBoundary>
                          <Suspense fallback={<PageFallback />}>
                            <Routes>
                              <Route path="/" element={<Dashboard />} />
                              <Route path="/transacoes" element={<Transactions />} />
                              <Route path="/lancamentos" element={<FutureLaunches />} />
                              <Route path="/cartoes" element={<CreditCardsPage />} />
                              <Route path="/projetos" element={<Projects />} />
                              <Route path="/investimentos" element={<Investments />} />
                              <Route path="/bancos" element={<Banks />} />
                              <Route path="/configuracoes" element={<Settings />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Suspense>
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
