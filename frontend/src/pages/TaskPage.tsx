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

import CreateNewHome from "@/components/CreateNewTask.tsx";
import type {TaskTableReturn} from "@/dto/TaskTableReturn.ts";
import {Button} from "@/components/ui/button.tsx";
import type {EditTask} from "@/dto/EditTask.ts";

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
        <div className={"taskPage"}>
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
                        ))
                    }
                </TableBody>
            </Table>
            <CreateNewHome/>
        </div>
    )
}

export default TaskPage