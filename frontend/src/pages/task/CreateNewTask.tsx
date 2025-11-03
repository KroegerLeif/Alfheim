
import { Button } from "@/components/ui/button.tsx"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import axios from "axios";
import type {CreateTask} from "@/dto/create/CreateTask.ts";

import type {Priority} from "@/dto/Priority.ts";
import {toast} from "sonner";
import {Controller, type SubmitHandler, useForm} from "react-hook-form";
import {Field, FieldDescription, FieldSet} from "@/components/ui/field.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {useState} from "react";

function CreateNewTask(prop: Readonly<{loadTaskData: () => void  }> ) {
    const loadData: () => void = prop.loadTaskData
    const [visible, setVisible] = useState(false)

    type FormFields = {
        name: string;
        items: string[];
        priority: Priority;
        dueDate: string;
        repetition: number;
    }

    const {register, handleSubmit, control} = useForm<FormFields>({
            defaultValues: {
                name: "Name",
                items: [],
                priority: "LOW",
                dueDate: "",
                repetition: 0,
            }
        }
    );

    const onSubmit: SubmitHandler<FormFields> = (data) => {

        const newTask: CreateTask = {
            name: data.name,
            items: [],
            priority: data.priority,
            dueDate: data.dueDate,
            repetition: data.repetition,
        };

        axios.post("/api/task/create", newTask)
            .then(() =>
                {
                    loadData()
                    setVisible(false)
                    toast.success("Task has been Created",{
                        description: "Data has been saved",
                    })
                })
            .catch((error) => {
                console.log(error)
                toast.warning("Problem:" + error)
            })
    }

    return (
        <Dialog open={visible} onOpenChange={setVisible}>
            <DialogTrigger className={"flex flex-row justify-end w-full"}>
                <Button variant="outline">+ add Task</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create new Task</DialogTitle>
                    <DialogDescription>
                        Create a new Task here.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} id="create-task-form" className={"grid gap-4"}>
                    <FieldSet>
                        <Field>
                            <Label htmlFor="name">Name</Label>
                            <Input {...register("name",
                                {required: true}
                            )}/>
                            <FieldDescription>This will apear in the Iterface</FieldDescription>
                        </Field>
                        <Field>
                            <Label htmlFor="priority">Priority</Label>
                            <Controller
                                control={control}
                                name="priority"
                                render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose Priority"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LOW">Low</SelectItem>
                                            <SelectItem value="MEDIUM">Medium</SelectItem>
                                            <SelectItem value="HIGH">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </Field>
                        <Field>
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input {...register("dueDate",
                                {required: true}
                            )} type={"date"}/>
                        </Field>
                        <Field>
                            <Label htmlFor="repetition">Repetition</Label>
                            <Input {...register("repetition")}
                                type={"number"}
                            />
                        </Field>
                    </FieldSet>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">Save changes</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default CreateNewTask;
