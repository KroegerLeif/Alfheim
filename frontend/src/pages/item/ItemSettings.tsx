import axios from "axios";
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
import {Button} from "@/components/ui/button.tsx";
import { toast } from "sonner"
import type {ItemTableReturn} from "@/dto/response/ItemTableReturn.ts";
import {useEffect, useState} from "react";
import type {EnergyLabel} from "@/dto/EnergyLabel.ts";
import {Controller, type SubmitHandler, useForm} from "react-hook-form";
import type {EditItemDTO} from "@/dto/edit/EditItemDTO.ts";
import {Field, FieldLabel, FieldSet} from "@/components/ui/field.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";



function ItemSettings(props : Readonly<ItemTableReturn & { loadItemData: () => void }>) {
    const {id,name,category,energyLabel,homeId, loadItemData} = props;

    const [open, setOpen] = useState(false);

    const[homeList, setHomeList] = useState(
        [
            {
                id:"",
                name:""
            }
        ]
    );

    type FormFields = {
        name: string;
        category: string;
        energyLabel: EnergyLabel;
        homeId: string;
    };

    const {register, handleSubmit, control} = useForm<FormFields>({
            defaultValues: {
                name: name,
                category: category,
                energyLabel: energyLabel,
                homeId: homeId
            }
        }
    );

    const onSubmit: SubmitHandler<FormFields> = (data) =>{
        const editDTO: EditItemDTO = {
            name: data.name,
            category: data.category,
            energyLabel: data.energyLabel,
            homeId: data.homeId
        }

        axios.patch("/api/item/" + id + "/edit", editDTO)
            .then(() => {
                loadItemData()
                setOpen(false);
            })
            .catch((error) => {
                console.log(error)
            }
        )

        toast.success("Item has been Updated",{
            description: "Changes have been saved",
        })

    }

    function getHomeNames(){
        axios.get("api/home/getNames")
            .then(response => {
                setHomeList(response.data);
            })
    }



    function deleteItem(id: string) {
        axios.delete("/api/item/" + id + "/delete")
            .then(() => loadItemData())
            .catch((error) => {
                console.log(error)
            })
    }

    useEffect(() =>{
        getHomeNames();
    },[])

    return(
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Settings</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Item</DialogTitle>
                    <DialogDescription>
                        Change Values from Item here.
                    </DialogDescription>
                </DialogHeader>
                <form id={"editItemForm"} onSubmit={handleSubmit(onSubmit)}>
                    <FieldSet>
                        <Field>
                            <FieldLabel htmlFor="name">Item Name</FieldLabel>
                            <Input {...register("name",
                                        {required: true}
                                    )}
                                type={"text"}
                                placeholder={name}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="energyLabel">Item Name</FieldLabel>
                            <Controller
                                control={control}
                                name="energyLabel"
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
                                )}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="Category">Item Name</FieldLabel>
                            <Input {...register("category")}
                                type={"text"}
                                placeholder={category}
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
                    </FieldSet>
                </form>
                <DialogFooter>
                    <Button form={"editItemForm"} type="submit">
                        Save
                    </Button>
                    <Button onClick={() => deleteItem(id)}
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

export default ItemSettings;