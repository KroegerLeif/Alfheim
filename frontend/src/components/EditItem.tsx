import type {EnergyLabel} from "@/dto/EnergyLabel.ts";
import {useNavigate} from "react-router-dom";
import {type FormEvent, useState} from "react";
import * as React from "react";

import axios from "axios";
import type {EditItemDTO} from "@/dto/edit/EditItemDTO.ts";
import {
    Dialog, DialogClose,
    DialogContent,
    DialogDescription, DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Input} from "@/components/ui/input.tsx";

type EditItemProps = {
    id: string;
    name: string;
    category: string;
    energyLabel: EnergyLabel;
}

function EditItem (prop: Readonly<EditItemProps>){

    const nav=useNavigate();

    const [formData, setFormData] = useState({
        name: prop.name,
        category: prop.category,
        energyLabel: prop.energyLabel,
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
        console.log("Submit function called!");
        event.preventDefault();

        const editItemDTO: EditItemDTO = {
            name: formData.name,
            category: formData.category,
            energyLabel: formData.energyLabel,
        };

        axios.patch("/api/item/" + prop.id + "/edit", editItemDTO)
            .then(() => nav("/"))
            .catch((error) => {
                    console.log(error)
                }
            );
    }

    return(
        <Dialog>
            <DialogTrigger asChild>
                <Button>Edit Item</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Item</DialogTitle>
                    <DialogDescription>
                        Change Values from Item here.
                    </DialogDescription>
                </DialogHeader>
                <form id="edit-item-form" onSubmit={submitForm}>
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
                            <Label htmlFor="category">Category</Label>
                            <Input
                                id="category"
                                name="category"
                                placeholder={prop.category}
                                onChange={handleInputChange('category')}
                                value={formData.category}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="energyLabel">Energy Label</Label>
                            <Input
                                id="energyLabel"
                                name="energyLabel"
                                placeholder={prop.energyLabel}
                                onChange={handleInputChange('energyLabel')}
                                value={formData.energyLabel}
                            />
                        </div>
                    </div>
                </form>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" form="edit-item-form">Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )


}

export default EditItem