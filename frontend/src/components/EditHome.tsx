import axios from "axios";

import {Button} from "@/components/ui/button.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Input} from "@/components/ui/input.tsx";
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
import type {Address} from "@/dto/Address.ts";
import {type FormEvent, useState} from "react";
import * as React from "react";
import {useNavigate} from "react-router-dom";
import type {EditHomeDTO} from "@/dto/edit/EditHomeDTO.ts";

type EditHomeProps = {
    id: string;
    name: string;
    address: Address;
}

function EditHome(props: Readonly<EditHomeProps>){

    const nav = useNavigate()

    const [formData, setFormData] = useState({
        name: props.name,
        street: props.address.street,
        postCode: props.address.postCode,
        city: props.address.city,
        country: props.address.country

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

        const editedHome: EditHomeDTO = {
            name: formData.name,
            address: {
                street: formData.street,
                postCode: formData.postCode,
                city: formData.city,
                country: formData.country
            }as Address,
        };

        axios.patch("/api/home/" + props.id + "/edit", editedHome)
            .then(() => nav("/"))
            .catch((error) => {
                console.log(error)
            }
        );
    }



    return(
        <Dialog>
            <DialogTrigger asChild>
                <Button>Edit Home</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Home</DialogTitle>
                    <DialogDescription>
                        Change Values from Home here.
                    </DialogDescription>
                </DialogHeader>
                <form id="edit-home-form" onSubmit={submitForm}>
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
                            <Label htmlFor="street">Street</Label>
                            <Input
                                id="street"
                                name="street"
                                placeholder={props.address.street}
                                onChange={handleInputChange('street')}
                                value={formData.street}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="postCode">Postcode</Label>
                            <Input
                                id="postCode"
                                name="postCode"
                                type="number"
                                placeholder={props.address.postCode}
                                onChange={handleInputChange('postCode')}
                                value={formData.postCode}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="city">City</Label>
                            <Input
                                id="city"
                                name="city"
                                placeholder={props.address.city}
                                onChange={handleInputChange('city')}
                                value={formData.city}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="country">Country</Label>
                            <Input
                                id="country"
                                name="country"
                                placeholder={props.address.country}
                                onChange={handleInputChange('country')}
                                value={formData.country}
                            />
                        </div>
                    </div>
                </form>
                <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                    <Button type="submit" form="edit-home-form">Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default EditHome;