import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {useEffect, useState} from "react";
import axios from "axios";
import type {ItemTableReturn} from "@/dto/response/ItemTableReturn.ts";
import CreateNewItem from "@/pages/item/CreateNewItem.tsx";
import {Dialog, DialogContent, DialogTrigger} from "@/components/ui/dialog.tsx";
import ItemInfo from "@/pages/item/ItemInfo.tsx";

function ItemPage() {

    const [itemTableData, setItemTableData] = useState<ItemTableReturn[]>([]);

    function loadItemData() {
        axios.get("/api/item")
            .then((response) => {
                setItemTableData(response.data);
            })
            .catch((error) => {
                console.log(error)
            })
    }

    useEffect(() => {
        loadItemData();
    }, []);

    return (
        <>
            <div className={"flex flex-col justify-center items-center w-full"}>
                <h1>Item Overview</h1>
                <CreateNewItem loadItemData={loadItemData}/>
            </div>
            <Table>
                <TableCaption>A list of all Items</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Name</TableHead>
                        <TableHead>Energy Label</TableHead>
                        <TableHead>Category</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        itemTableData.map((item_data) => (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <TableRow>
                                        <TableCell className="font-medium"
                                                   key={item_data.id}>{item_data.name}</TableCell>
                                        <TableCell>{item_data.energyLabel}</TableCell>
                                        <TableCell>{item_data.category}</TableCell>
                                    </TableRow>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[90vh]">
                                    <ItemInfo {...item_data} loadItemData={loadItemData}/>
                                </DialogContent>
                            </Dialog>
                        ))
                    }
                </TableBody>
            </Table>
        </>
    )
}

export default ItemPage