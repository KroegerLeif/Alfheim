import {DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog.tsx";
import {Button} from "@/components/ui/button.tsx";
import type {TaskTableReturn} from "@/dto/response/TaskTableReturn.ts";
import TaskSettings from "@/pages/task/TaskSettings.tsx";

function TaskInfo(props: Readonly<TaskTableReturn & { loadTaskData: () => void }>) {
    const { name, items, assignedTo, priority, status, dueDate, repetition, homeData } = props;

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
                Assigned To: {assignedTo} <br/>
                Already completed tasks: {items?.length} <br/>
                <div>
                    Items:
                    {items && items.length > 0 ? (
                        <ul className="list-disc list-inside pl-4">
                            {items.map((item, index) =>
                                <li key={`${item}-${index}`}>{item}</li>)}
                        </ul>
                    ) : (
                        " None"
                    )}
                </div>
                Priority: {priority} <br/>
                Status: {status}<br/>
                Due Date: {dueDate} <br/>
                Repetition in Days: {repetition} <br/>
                Home: {homeData.name}
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