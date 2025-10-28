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
import CreateNewItem from "@/components/CreateNewItem.tsx";
import {Button} from "@/components/ui/button.tsx";

function ItemPage(){

    const [itemTableData, setItemTableData] = useState<ItemTableReturn[]>([]);

    function loadItemData(){
        axios.get("/api/item")
            .then((response) =>
            {setItemTableData(response.data);})
            .catch((error) => {console.log(error)})
    }

    useEffect(() => {
        loadItemData();
    }, []);

    function deleteItem(id: string) {
        axios.delete("/api/item/" + id + "/delete")
            .then(() => loadItemData())
            .catch((error) => {console.log(error)})
    }

    return(
        <div className={"itemPage"}>
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
                            <TableRow>
                                <TableCell className="font-medium" key={item_data.id}>{item_data.name}</TableCell>
                                <TableCell>{item_data.energyLabel}</TableCell>
                                <TableCell>{item_data.category}</TableCell>
                                <TableCell>
                                    <Button onClick={() => deleteItem(item_data.id)}
                                            variant={"destructive"}>
                                        Delete
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    }
                </TableBody>
            </Table>
            <CreateNewItem/>
        </div>
    )
}

export default ItemPage