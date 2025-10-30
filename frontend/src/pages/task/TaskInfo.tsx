import {DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog.tsx";
import {Button} from "@/components/ui/button.tsx";
import type {TaskTableReturn} from "@/dto/response/TaskTableReturn.ts";
import TaskSettings from "@/pages/task/TaskSettings.tsx";

function TaskInfo({name,items,assignedTo,priority,status,dueDate}: Readonly<TaskTableReturn>) {

    return(
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {name}
                </DialogTitle>
                <DialogDescription>
                    Manage property details and household members
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
                number of tasks: {items} <br/>
                number of items: {assignedTo} <br/>
                Priority: {priority} <br/>
                Status: {status}<br/>
                Due Date: {dueDate} <br/>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
                <TaskSettings/>
            </DialogFooter>
        </>
    )
}

export default TaskInfo;