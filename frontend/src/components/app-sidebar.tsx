import {WashingMachine, CalendarCheck, HousePlus, Inbox} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import Logout from "@/components/Logout.tsx";

// Menu items.
const items = [
    {
        title: "Home Managment",
        url: "/home",
        icon: HousePlus,
    },
    {
        title: "Task",
        url: "/task",
        icon: Inbox,
    },
    {
        title: "Items",
        url: "/item",
        icon: WashingMachine,
    },
    {
        title: "Schedule",
        url: "/schedule",
        icon: CalendarCheck,
    },
]

export function AppSidebar() {
    return (
        <Sidebar>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel><a href={"/"}>Alfheim</a></SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <a href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                        <Logout />
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}