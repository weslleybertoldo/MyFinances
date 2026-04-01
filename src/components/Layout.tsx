import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import UpdateChecker from "@/components/UpdateChecker";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-4">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">Controle Financeiro Pessoal</span>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
          <footer className="border-t bg-card px-4 py-2">
            <UpdateChecker />
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
