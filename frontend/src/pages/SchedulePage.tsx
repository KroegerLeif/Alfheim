import {Clock, Calendar as CalendarIcon} from "lucide-react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@radix-ui/react-tabs";
import {useEffect, useState} from "react";
import type {TaskTableReturn} from "@/dto/TaskTableReturn.ts";
import axios from "axios";



function SchedulePage(){

    const [scheduledTasks, setscheduledTasks] = useState<TaskTableReturn[]>([]);

    useEffect(() => {
        loadTaskData();
    }, []);

    function loadTaskData(){
        axios.get("/api/task")
            .then((response) =>
                {
                    setscheduledTasks(response.data);
                }
            )
            .catch((error) => {console.log(error)})
    }

    // Hilfsfunktion, um ein Datum in das Format YYYY-MM-DD umzuwandeln
    const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zeit auf Mitternacht setzen für genaue Vergleiche

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 6); // Heute + 6 Tage

    const todayString = formatDate(today);
    const tomorrowString = formatDate(tomorrow);

    const todayTasks = scheduledTasks.filter(task => task.dueDate === todayString);
    const tomorrowTasks = scheduledTasks.filter(task => task.dueDate === tomorrowString);
    const thisWeekTasks = scheduledTasks.filter(task => {
        const taskDate = new Date(task.dueDate);
        return taskDate >= today && taskDate <= endOfWeek;
    });

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1>Maintenance Schedule</h1>
                <p className="text-muted-foreground">Plan and track scheduled maintenance activities</p>
            </div>


                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Scheduled Tasks</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="week" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="today">Today</TabsTrigger>
                                <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
                                <TabsTrigger value="week">This Week</TabsTrigger>
                            </TabsList>
                            <TabsContent value="today" className="space-y-4 mt-4">
                                {todayTasks.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No tasks scheduled for today</p>
                                ) : (
                                    todayTasks.map((task) => (
                                        <div key={task.id} className="flex items-start justify-between p-4 border rounded-lg">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm">{task.dueDate}</span>
                                                </div>
                                                <p>{task.items}</p>
                                                <p className="text-sm text-muted-foreground">{task.name}</p>
                                                <p className="text-sm text-muted-foreground">Assigned to: {task.assignedTo}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </TabsContent>
                            <TabsContent value="tomorrow" className="space-y-4 mt-4">
                                {tomorrowTasks.map((task) => (
                                    <div key={task.id} className="flex items-start justify-between p-4 border rounded-lg">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm">{task.dueDate}</span>
                                            </div>
                                            <p>{task.items}</p>
                                            <p className="text-sm text-muted-foreground">{task.name}</p>
                                            <p className="text-sm text-muted-foreground">Assigned to: {task.assignedTo}</p>
                                        </div>
                                    </div>
                                ))}
                            </TabsContent>
                            <TabsContent value="week" className="space-y-4 mt-4">
                                {thisWeekTasks.map((task) => (
                                    <div key={task.id} className="flex items-start justify-between p-4 border rounded-lg">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm">{task.dueDate}</span>
                                            </div>
                                            <p>{task.items}</p>
                                            <p className="text-sm text-muted-foreground">{task.name}</p>
                                            <p className="text-sm text-muted-foreground">Assigned to: {task.assignedTo}</p>
                                        </div>
                                    </div>
                                ))}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

    );
}

export default SchedulePage;