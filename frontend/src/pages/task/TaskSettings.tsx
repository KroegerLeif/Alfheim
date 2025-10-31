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
import {useEffect, useState} from "react";
import {type SubmitHandler, useForm, Controller} from "react-hook-form";
import type {Priority} from "@/dto/Priority.ts";
import type {Status} from "@/dto/Status.ts";
import type {EditTaskSeriesDTO} from "@/dto/edit/EditTaskSeriesDTO.ts";

function TaskSettings({taskSeriesId, name, priority, status, dueDate,repetition,homeId, loadTaskData}:
                      Readonly<TaskTableReturn &
                      {loadTaskData: () => void} >){

    const [homeList, setHomeList] = useState([
        {
            id:"",
            name:""
        }
    ]);

    type FormFields = {
        name: string;
        priority: Priority;
        homeId: string;
        status: Status;
        dueDate: string;
        repetition: number;
    };

    const {register, handleSubmit, control} = useForm<FormFields>({
            defaultValues: {
                name:name,
                priority:priority,
                homeId:homeId,
                status:status,
                dueDate:dueDate,
                repetition:repetition
            }
        }
    );

    const onSubmit: SubmitHandler<FormFields> = (data) => {
        const editDTO: EditTaskSeriesDTO = {
            name: data.name,
            items: [],
            assignedTo: [],
            priority: data.priority,
            status: data.status,
            dueDate: data.dueDate,
            repetition: data.repetition,
            homeId: data.homeId,
        }

        axios.patch("api/task/" + taskSeriesId + "/editTaskSeries", editDTO)
            .then(() => loadTaskData());
    }


    function deleteTask(id: string){
        axios.delete("api/task/" + id + "/delete")
            .then(() => loadTaskData())
    }

    function getHomeNames(){
        axios.get("api/home/getNames")
            .then(response => {
                setHomeList(response.data);
            })
    }


    useEffect(() =>{
        getHomeNames();
    },[])

    return(
        <Dialog>
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
                                <Input {...register("name",
                                            {required: true})
                                        } type="text" autoComplete="off" placeholder={name}/>
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
                                                <SelectValue placeholder="Choose Priority"/>
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
                                                <SelectValue placeholder="Choose Home"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {homeList.map(homeName => (
                                                    <SelectItem key={homeName.id} value={homeName.id}>{homeName.name}</SelectItem>
                                                ))}
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
                                                <SelectValue placeholder="Choose Status"/>
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
                                <Input {...register("dueDate",
                                            {required: true})
                                        } type="date" autoComplete="off" placeholder={dueDate}/>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="repetition">Repetition</FieldLabel>
                                <Input {...register("repetition")}
                                    type="number" placeholder={repetition.toString()}/>
                            </Field>
                        <Button type="submit">
                            Save
                        </Button>
                    </FieldSet>
                </form>
                <DialogFooter>
                    <Button onClick={() => deleteTask(taskSeriesId)}
                            variant={"destructive"}>
                        Delete
                    </Button>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
export default TaskSettings;