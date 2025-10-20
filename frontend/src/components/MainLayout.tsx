import { AppSidebar } from "./app-sidebar";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "./ui/sidebar"; // Sie hatten diesen Provider, also nehmen wir ihn wieder

export function MainLayout() {
    return (
        <SidebarProvider>
            <div className="flex">
                <AppSidebar />
                <main className="flex-grow p-4">
                    {/* HIER wird der Inhalt Ihrer Seiten (HomePage, DemoPage) angezeigt */}
                    <Outlet />
                </main>
            </div>
        </SidebarProvider>
    );
}