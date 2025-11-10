import { AlertCircle, CheckCircle2, Clock, Home } from "lucide-react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";

const stats = [
    {
        title: "My Homes",
        value: "2",
        description: "Properties tracked",
        icon: Home,
        color: "text-blue-600 dark:text-blue-400"
    },
    {
        title: "Tasks To Do",
        value: "5",
        description: "+2 from last week",
        icon: AlertCircle,
        color: "text-orange-600 dark:text-orange-400"
    },
    {
        title: "Completed This Month",
        value: "12",
        description: "Great work!",
        icon: CheckCircle2,
        color: "text-green-600 dark:text-green-400"
    },
    {
        title: "Due This Week",
        value: "8",
        description: "Tasks scheduled",
        icon: Clock,
        color: "text-purple-600"
    }
];

export function Dashboard() {

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1>Dashboard</h1>
                <p className="text-muted-foreground">Your home maintenance overview</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm">{stat.title}</CardTitle>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}