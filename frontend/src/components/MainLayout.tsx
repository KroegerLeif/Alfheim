import { AppSidebar } from "./app-sidebar";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "./ui/sidebar";
import {Toaster} from "sonner";

export function MainLayout() {
    return (
        <SidebarProvider>
            <div className="flex flex-row min-h-screen w-screen p-8">
                <AppSidebar />
                <main className="flex-grow p-4">
                    <Outlet />
                    <Toaster />
                </main>
            </div>
        </SidebarProvider>
    );
}