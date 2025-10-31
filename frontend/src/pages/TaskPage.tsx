import {useEffect, useState} from "react";
import axios from "axios";

import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import type {TaskTableReturn} from "@/dto/response/TaskTableReturn.ts";
import {Button} from "@/components/ui/button.tsx";
import type {EditTask} from "@/dto/edit/EditTask.ts";
import CreateNewTask from "@/components/create/CreateNewTask.tsx";

import TaskInfo from "@/pages/task/TaskInfo.tsx";
import {Dialog, DialogContent, DialogTrigger} from "@/components/ui/dialog.tsx";

function TaskPage(){

    const [taskTableData, setTaskTableData] = useState<TaskTableReturn[]>([]);

    function loadTaskData(){
        axios.get("/api/task")
            .then((response) =>
            {setTaskTableData(response.data);})
            .catch((error) => {console.log(error)})
    }

    function taskDone(edited: string ){
        const editTask: EditTask = {
            status: "CLOSED",
            dueDate: ""
        }
        axios.patch("api/task/"+ edited + "/edit-task",editTask)
        .then(() => loadTaskData())
        .catch((error) => {console.log(error)})
    }

    useEffect(() => {
        loadTaskData();
    }, []);

    return(
        <>
            <div className={"flex flex-col justify-center items-center w-full"}>
                <h1>Task Overview</h1>
                <CreateNewTask/>
            </div>
            <Table>
                <TableCaption>A list of all Tasks</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Name</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>TaskDone</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        taskTableData.map((task_data) => (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <TableRow>
                                        <TableCell className="font-medium" key={task_data.id}>{task_data.name}</TableCell>
                                        <TableCell>{task_data.items}</TableCell>
                                        <TableCell>{task_data.assignedTo}</TableCell>
                                        <TableCell>{task_data.priority}</TableCell>
                                        <TableCell>{task_data.status}</TableCell>
                                        <TableCell>{task_data.dueDate}</TableCell>
                                        <TableCell>
                                            <Button onClick={() => taskDone(task_data.taskSeriesId)} > ✔︎</Button>
                                        </TableCell>
                                    </TableRow>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[90vh]">
                                    <TaskInfo id={task_data.id}
                                              taskSeriesId={task_data.taskSeriesId}
                                              name={task_data.name}
                                              items={task_data.items}
                                              assignedTo={task_data.assignedTo}
                                              priority={task_data.priority}
                                              status={task_data.status}
                                              dueDate={task_data.dueDate}
                                              loadTaskData={loadTaskData}
                                              repetition={0}
                                              homeId={""}/>
                                </DialogContent>
                            </Dialog>
                        ))
                    }
                </TableBody>
            </Table>
        </>
    )
}

export default TaskPage