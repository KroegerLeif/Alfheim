import { AppSidebar } from "./app-sidebar";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "./ui/sidebar";
export function MainLayout() {
    return (
        <SidebarProvider>
            <div className="flex flex-row min-h-screen w-screen p-8">
                <AppSidebar />
                <main className="flex-grow p-4">
                    {/* HIER wird der Inhalt der Seiten (HomePage, DemoPage) angezeigt */}
                    <Outlet />
                </main>
            </div>
        </SidebarProvider>
    );
}