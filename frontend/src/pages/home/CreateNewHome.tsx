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
import {useState} from "react";
import axios from "axios";
import type {CreateHomeDTO} from "@/dto/create/CreateHomeDTO.ts";
import {toast} from "sonner";
import {type SubmitHandler, useForm} from "react-hook-form";
import {Field, FieldLabel, FieldSet} from "@/components/ui/field.tsx";

function CreateNewHome(prop: Readonly<{loadHomeData: () => void  }>) {
    const loadData: () => void = prop.loadHomeData
    const [visible, setVisible] = useState(false)

    type FormFields = {
        name: string;
        street: string;
        postCode: string;
        city: string;
        country: string;
    }

    const {register,handleSubmit} = useForm<FormFields>({
        defaultValues: {
            name: "",
            street: "",
            postCode: "",
            city: "",
            country: ""
        }
    })

    const onSubmit: SubmitHandler<FormFields> = (data) => {

        const newHome: CreateHomeDTO = {
            name: data.name,
            address: {
                street: data.street,
                postCode: data.postCode,
                city: data.city,
                country: data.country
            }
        };

        axios.post("/api/home/create", newHome)
            .then(() => {
                loadData()
                setVisible(false)
                toast.success("Home has been Created",{
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
                <Button variant="outline">+ add Home</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create new Home</DialogTitle>
                    <DialogDescription>
                        Create a new Home here.
                    </DialogDescription>
                </DialogHeader>
                <form id={"addHomeForm"} onSubmit={handleSubmit(onSubmit)}>
                    <FieldSet>
                        <Field>
                            <FieldLabel htmlFor={"name"}>Home Name</FieldLabel>
                            <Input {...register("name",
                                {required: true}
                            )}/>
                        </Field>
                    </FieldSet>
                    <FieldSet>
                        <Field>
                            <FieldLabel htmlFor={"street"}>Street</FieldLabel>
                            <Input {...register("street")} autoComplete={"street-address"}/>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor={"postCode"}>Post Code</FieldLabel>
                            <Input {...register("postCode")} autoComplete={"postal-code"}/>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor={"city"}>City</FieldLabel>
                            <Input {...register("city")} autoComplete={"address-level2"}/>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor={"country"}>Country</FieldLabel>
                            <Input {...register("country")} autoComplete={"country"}/>
                        </Field>
                    </FieldSet>
                </form>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button form={"addHomeForm"} type="submit">Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
export default CreateNewHome;