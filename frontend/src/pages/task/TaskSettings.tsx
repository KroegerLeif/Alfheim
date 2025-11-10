import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogClose,
    DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
    Field,
    FieldDescription,
    FieldLabel,
    FieldSet,
} from "@/components/ui/field";
import {Button} from "@/components/ui/button.tsx";
import axios from "axios";
import type {TaskTableReturn} from "@/dto/response/TaskTableReturn.ts";
import {Input} from "@/components/ui/input.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {useEffect, useState, useCallback} from "react";
import {type SubmitHandler, useForm, Controller} from "react-hook-form";
import type {Priority} from "@/dto/Priority.ts";
import type {Status} from "@/dto/Status.ts";
import type {EditTaskSeriesDTO} from "@/dto/edit/EditTaskSeriesDTO.ts";
import {toast} from "sonner";

function TaskSettings({
                          taskSeriesId, name, priority, status, dueDate, repetition, homeData, loadTaskData, items
                      }: Readonly<TaskTableReturn & { loadTaskData: () => void }>) {

    const [open, setOpen] = useState(false);

    const [homeList, setHomeList] = useState<{id: string; name: string}[]>([]);
    const [itemlist, setItemList] = useState<{id: string; name: string}[]>([]);

    type FormFields = {
        name: string;
        priority: Priority;
        homeId: string;
        status: Status;
        dueDate: string;
        repetition: number;
        item: string;
    };

    const {register, handleSubmit, control, reset} = useForm<FormFields>({
        defaultValues: {
            name,
            priority,
            homeId: homeData?.id ?? "",
            status,
            dueDate,
            repetition,
            item: ""
        }
    });

    useEffect(() => {
        axios.get("api/home/getNames")
            .then(response => {
                setHomeList(response.data);
            })
            .catch(error => {
                console.error("Error loading home names:", error);
            });
        axios.get("api/item/getNames")
            .then(response => {
                setItemList(response.data);
            })
            .catch(error => {
                console.error("Error loading item names:", error);
            });
    }, []);

    // Setze das Item-Feld nur wenn itemlist oder items sich ändert und nur wenn wirklich nötig
    useEffect(() => {
        if (itemlist.length > 0 && items && items.length > 0) {
            const firstItemName = items[0];
            const selectedItem = itemlist.find(item => item.name === firstItemName);
            if (selectedItem) {
                reset(prevValues => ({ ...prevValues, item: selectedItem.id }));
            }
        }
    }, [itemlist, items, reset]);

    const onSubmit: SubmitHandler<FormFields> = useCallback((data) => {
        const editDTO: EditTaskSeriesDTO = {
            name: data.name,
            itemId: [data.item],
            assignedTo: [],
            priority: data.priority,
            status: data.status,
            dueDate: data.dueDate,
            repetition: data.repetition,
            homeId: data.homeId,
        };

        axios.patch(`api/task/${taskSeriesId}/editTaskSeries`, editDTO)
            .then(() => {
                loadTaskData();
                setOpen(false);
                toast.success("Task has been Updated", {
                    description: "Changes have been saved",
                });
            })
            .catch((error) => {
                console.log(error);
                toast.warning("Problem: " + error);
            });
    }, [taskSeriesId, loadTaskData]);

    const deleteTask = useCallback((id: string) => {
        axios.delete(`api/task/${id}/delete`)
            .then(() => {
                loadTaskData();
                toast.success("Task has been Deleted", {
                    description: "Changes have been saved",
                });
            })
            .catch((error) => {
                console.log(error);
                toast.warning("Problem: " + error);
            });
    }, [loadTaskData]);

    const renderSelectItems = (list: {id: string; name: string}[]) =>
        list.map(item => (
            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
        ));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Settings</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Task</DialogTitle>
                    <DialogDescription>
                        Change Values from Task here.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <FieldSet>
                        <Field>
                            <FieldLabel htmlFor="name">Task Name</FieldLabel>
                            <Input {...register("name", {required: true})} type="text" autoComplete="off" placeholder={name} />
                            <FieldDescription>This appears on invoices and emails.</FieldDescription>
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="priority">Priority</FieldLabel>
                            <Controller
                                control={control}
                                name="priority"
                                render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose Priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="HIGH">High</SelectItem>
                                            <SelectItem value="MEDIUM">Medium</SelectItem>
                                            <SelectItem value="LOW">Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="home">Home</FieldLabel>
                            <Controller
                                control={control}
                                name="homeId"
                                render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose Home" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {renderSelectItems(homeList)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="item">Item</FieldLabel>
                            <Controller
                                control={control}
                                name="item"
                                render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose Item" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {renderSelectItems(itemlist)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="status">Status</FieldLabel>
                            <Controller
                                control={control}
                                name="status"
                                render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="OPEN">Open</SelectItem>
                                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                            <SelectItem value="CLOSED">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="dueDate">Due Date</FieldLabel>
                            <Input {...register("dueDate", {required: true})} type="date" autoComplete="off" placeholder={dueDate} />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="repetition">Repetition</FieldLabel>
                            <Input {...register("repetition")} type="number" placeholder={repetition.toString()} />
                        </Field>

                        <Button type="submit">Save</Button>
                    </FieldSet>
                </form>

                <DialogFooter>
                    <Button onClick={() => deleteTask(taskSeriesId)} variant="destructive">Delete</Button>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default TaskSettings;
