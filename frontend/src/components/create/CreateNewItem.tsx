
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
import {type FormEvent, useState} from "react";
import axios from "axios";

import type {CreateItem} from "@/dto/create/CreateItem.ts";

import {useNavigate} from "react-router-dom";
import * as React from "react";
import type {EnergyLabel} from "@/dto/EnergyLabel.ts";

function CreateNewHome() {

    const nav = useNavigate()

    const [formData, setFormData] = useState({
        name: '',
        energyLabel: '',
        category: '',
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

        const newItem: CreateItem = {
            name: formData.name,
            energyLabel: formData.energyLabel as EnergyLabel,
            category: formData.category,
        };

        axios.post("/api/item/create", newItem)
            .then(() => setFormData({
                name: '',
                energyLabel: '',
                category: ''
            }))
            .then(() => nav("/"))
            .catch((error) => {
                console.log(error)
            })
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">Create New Item</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create new Item</DialogTitle>
                    <DialogDescription>
                        Create a new Item here.
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
                            <Label htmlFor="energyLabel">Ernergy Label</Label>
                            <Input
                                id="energyLabel"
                                name="energyLabel"
                                placeholder="A -> G"
                                onChange={handleInputChange('energyLabel')}
                                value={formData.energyLabel}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="category">Category</Label>
                            <Input
                                id="category"
                                name="category"
                                onChange={handleInputChange('category')}
                                value={formData.category}
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