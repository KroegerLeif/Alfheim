import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription, DialogClose, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {Button} from "@/components/ui/button.tsx";

function TaskSettings(){

    return(
        <Dialog>
            <DialogTrigger asChild>
                <Button>Settings</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Home</DialogTitle>
                    <DialogDescription>
                        Change Values from Home here.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
export default TaskSettings;