import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import PageSkeleton from "@/components/ui/PageSkeleton";
import AppUpdateManager from "@/components/AppUpdateManager";
import { saveUpdateContext } from "@/lib/appUpdate";

// Eager-loaded (always needed)
import LoginPage from "./pages/Login";
import DashboardLayout from "./components/DashboardLayout";

type LazyFactory<T = unknown> = () => Promise<{ default: ComponentType<T> }>;

const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message);
};

const lazyWithRecovery = <T,>(factory: LazyFactory<T>, key: string) =>
  lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(`lazy-reload:${key}`);
      return mod;
    } catch {
      // Small retry for transient network glitches
      await new Promise((resolve) => setTimeout(resolve, 350));
      try {
        const mod = await factory();
        sessionStorage.removeItem(`lazy-reload:${key}`);
        return mod;
      } catch (error) {
        // One-time hard reload for stale chunk references after deployments
        if (isChunkLoadError(error)) {
          const reloadKey = `lazy-reload:${key}`;
          if (!sessionStorage.getItem(reloadKey)) {
            sessionStorage.setItem(reloadKey, "1");
            saveUpdateContext();
            window.location.reload();
            return new Promise<never>(() => undefined);
          }
        }
        throw error;
      }
    }
  });

// Lazy-loaded pages (code splitting) with recovery
const IndexPage = lazyWithRecovery(() => import("./pages/Index"), "index");
const TarefasPage = lazyWithRecovery(() => import("./pages/Tarefas"), "tarefas");
const AnaliticasPage = lazyWithRecovery(() => import("./pages/Analiticas"), "analiticas");
const UsuariosPage = lazyWithRecovery(() => import("./pages/Usuarios"), "usuarios");
const ComodatoPage = lazyWithRecovery(() => import("./pages/Comodato"), "comodato");
const IntegracoesPage = lazyWithRecovery(() => import("./pages/Integracoes"), "integracoes");
const SuportePage = lazyWithRecovery(() => import("./pages/Suporte"), "suporte");
const NotFound = lazyWithRecovery(() => import("./pages/NotFound"), "not-found");

const CalendarioPage = lazyWithRecovery(() => import("./pages/Calendario"), "calendario");
const AdminDiagnosticoPage = lazyWithRecovery(() => import("./pages/AdminDiagnostico"), "admin-diagnostico");
const FerramentasPage = lazyWithRecovery(() => import("./pages/Ferramentas"), "ferramentas");
const Sprint6BonificacaoPage = lazyWithRecovery(() => import("./pages/sprint6/Sprint6BonificacaoPage"), "sprint6-bonificacao");
const ClientesPage = lazyWithRecovery(() => import("./pages/clientes/ClientesPage"), "clientes");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const LazyPage = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
  </ErrorBoundary>
);

const AppRoutes = () => (
  <>
    <AppUpdateManager />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<LazyPage><IndexPage /></LazyPage>} />
        <Route path="/tarefas" element={<LazyPage><TarefasPage /></LazyPage>} />
        <Route path="/analiticas" element={<LazyPage><AnaliticasPage /></LazyPage>} />
        <Route path="/usuarios" element={<LazyPage><UsuariosPage /></LazyPage>} />
        <Route path="/integracoes" element={<LazyPage><IntegracoesPage /></LazyPage>} />
        <Route path="/comodato" element={<LazyPage><ComodatoPage /></LazyPage>} />
        <Route path="/suporte" element={<LazyPage><SuportePage /></LazyPage>} />
        <Route path="/ferramentas" element={<LazyPage><FerramentasPage /></LazyPage>} />
        <Route path="/calendario" element={<LazyPage><CalendarioPage /></LazyPage>} />
        <Route path="/admin/diagnostico" element={<LazyPage><AdminDiagnosticoPage /></LazyPage>} />
        <Route path="/admin/testes/bonificacao" element={<LazyPage><Sprint6BonificacaoPage /></LazyPage>} />
        <Route path="/admin/testes/clientes" element={<LazyPage><ClientesPage /></LazyPage>} />
      </Route>
      <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
    </Routes>
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
