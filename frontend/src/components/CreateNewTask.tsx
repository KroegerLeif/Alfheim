
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {type FormEvent, useState} from "react";
import axios from "axios";
import type {CreateTask} from "@/dto/CreateTask.ts";

import {useNavigate} from "react-router-dom";
import * as React from "react";
import type {Priority} from "@/dto/Priority.ts";

function CreateNewHome() {

    const nav = useNavigate()

    const [formData, setFormData] = useState({
        name: '',
        items: '',
        priority: '',
        dueDate: '',
        repetition: '0'
    });

    const handleInputChange = (field: keyof typeof formData) => (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setFormData(prev => ({
            ...prev,
            [field]: event.target.value
        }));
    };

    function submitForm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const newTask: CreateTask = {
            name: formData.name,
            items: [], // TODO: Parse items properly
            priority: formData.priority as Priority,
            dueDate: formData.dueDate,
            repetition: parseInt(formData.repetition) || 0
        };

        axios.post("/api/task/create", newTask)
            .then(() => setFormData({
                name: '',
                items: '',
                priority: '',
                dueDate: '',
                repetition: '0'
            }))
            .then(() => nav("/"))
            .catch((error) => {
                console.log(error)
            })
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">Create New Task</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create new Task</DialogTitle>
                    <DialogDescription>
                        Create a new Task here.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitForm}>
                    <div className="grid gap-4">
                        <div className="grid gap-3">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Task name"
                                onChange={handleInputChange('name')}
                                value={formData.name}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="priority">Priority</Label>
                            <Input
                                id="priority"
                                name="priority"
                                placeholder="LOW, MEDIUM, HIGH"
                                onChange={handleInputChange('priority')}
                                value={formData.priority}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input
                                id="dueDate"
                                name="dueDate"
                                type="date"
                                onChange={handleInputChange('dueDate')}
                                value={formData.dueDate}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="repetition">Repetition</Label>
                            <Input
                                id="repetition"
                                name="repetition"
                                type="number"
                                placeholder="0"
                                onChange={handleInputChange('repetition')}
                                value={formData.repetition}
                            />
                        </div>
                    </div>
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

export default CreateNewHome;