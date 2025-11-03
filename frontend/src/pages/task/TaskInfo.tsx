import {DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog.tsx";
import {Button} from "@/components/ui/button.tsx";
import type {TaskTableReturn} from "@/dto/response/TaskTableReturn.ts";
import TaskSettings from "@/pages/task/TaskSettings.tsx";

function TaskInfo(props: Readonly<TaskTableReturn & { loadTaskData: () => void }>) {
    const { name, items, assignedTo, priority, status, dueDate, repetition, homeId } = props;

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
                number of tasks: {items?.length} <br/>
                number of items: {assignedTo?.length} <br/>
                Priority: {priority} <br/>
                Status: {status}<br/>
                Due Date: {dueDate} <br/>
                Repetition: {repetition} <br/>
                Home: {homeId}
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
                <TaskSettings {...props}/>
            </DialogFooter>
        </>
    )
}

export default TaskInfo;