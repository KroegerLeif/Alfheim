
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

import type {CreateItem} from "@/dto/create/CreateItem.ts";

import type {EnergyLabel} from "@/dto/EnergyLabel.ts";
import {toast} from "sonner";
import {Controller, type SubmitHandler, useForm} from "react-hook-form";
import {Field, FieldLabel, FieldSet} from "@/components/ui/field.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";

function CreateNewItem(prop: Readonly<{loadItemData: () => void  }> ) {

    const loadData: () => void = prop.loadItemData
    const [visible, setVisible] = useState(false)

    type FormFields = {
        name: string;
        energyLabel: EnergyLabel;
        category: string;
    }

    const {register,handleSubmit,control} = useForm<FormFields>({
        defaultValues: {
            name: "",
            energyLabel: "G",
            category: ""
        }
    })

    const onSubmit: SubmitHandler<FormFields> = (data) =>  {

        const newItem: CreateItem = {
            name: data.name,
            energyLabel: data.energyLabel,
            category: data.category,
        };

        axios.post("/api/item/create", newItem)
            .then(() => {
                loadData()
                setVisible(false)
                toast.success("Item has been Created",{
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
                <Button variant="outline">+ add Item</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create new Item</DialogTitle>
                    <DialogDescription>
                        Create a new Item here.
                    </DialogDescription>
                </DialogHeader>
                <form id={"addItemForm"} onSubmit={handleSubmit(onSubmit)}>
                    <FieldSet>
                        <Field>
                            <FieldLabel htmlFor={"name"}>Item Name</FieldLabel>
                            <Input {...register("name",
                                {required: true}
                            )}/>
                        </Field>
                        <Field>
                            <Controller control={control}
                                  name={"energyLabel"}
                                  render={({field}) => (
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose Energy Label"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="A">A</SelectItem>
                                            <SelectItem value="B">B</SelectItem>
                                            <SelectItem value="C">C</SelectItem>
                                            <SelectItem value="D">D</SelectItem>
                                            <SelectItem value="E">E</SelectItem>
                                            <SelectItem value="F">F</SelectItem>
                                            <SelectItem value="G">G</SelectItem>
                                        </SelectContent>
                                     </Select>
                            )}/>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor={"category"}>Category</FieldLabel>
                            <Input {...register("category")}
                                type={"text"}/>
                        </Field>
                    </FieldSet>
                </form>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button form={"addItemForm"}
                            type="submit">
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default CreateNewItem;