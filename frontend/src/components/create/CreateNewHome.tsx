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
import type {CreateHomeDTO} from "@/dto/create/CreateHomeDTO.ts";
import {useNavigate} from "react-router-dom";

function CreateNewHome() {

    const nav = useNavigate()

    const [formData, setFormData] = useState({
        name: '',
        street: '',
        postCode: '',
        city: '',
        country: ''
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

        const newHome: CreateHomeDTO = {
            name: formData.name,
            address: {
                street: formData.street,
                postCode: formData.postCode,
                city: formData.city,
                country: formData.country
            }
        };

        axios.post("/api/home/create", newHome)
            .then(() => setFormData({
                name: '',
                street: '',
                postCode: '',
                city: '',
                country: ''
            }))
            .then(() => nav("/"))

            .catch((error) => {
                console.log(error)
            })
    }

    return (
        <Dialog>
            <DialogTrigger className={"flex flex-row justify-end w-full"}>
                <Button variant="outline">Create New Home</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create new Home</DialogTitle>
                    <DialogDescription>
                        Create a new Home here.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitForm}>
                    <div className="grid gap-4">
                        <div className="grid gap-3">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Unbekannt"
                                onChange={handleInputChange('name')}
                                value={formData.name}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="street">Street</Label>
                            <Input
                                id="street"
                                name="street"
                                placeholder="Street"
                                onChange={handleInputChange('street')}
                                value={formData.street}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="postcode">Postcode</Label>
                            <Input
                                id="postCode"
                                name="postCode"
                                placeholder="postCode"
                                onChange={handleInputChange('postCode')}
                                value={formData.postCode}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="city">City</Label>
                            <Input
                                id="city"
                                name="city"
                                placeholder="City"
                                onChange={handleInputChange('city')}
                                value={formData.city}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="country">Country</Label>
                            <Input
                                id="country"
                                name="country"
                                placeholder="Country"
                                onChange={handleInputChange('country')}
                                value={formData.country}
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