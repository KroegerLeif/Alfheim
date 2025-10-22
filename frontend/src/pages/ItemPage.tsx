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
import type {ItemTableReturn} from "@/dto/ItemTableReturn.ts";

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

    return(
        <div className={"itemPage"}>
            <Table>
                <TableCaption>A list of all Tasks</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Name</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Energy Label</TableHead>
                        <TableHead>Category</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        itemTableData.map((item_data) => (
                            <TableRow>
                                <TableCell className="font-medium" key={item_data.id}>{item_data.name}</TableCell>
                                <TableCell>{item_data.id}</TableCell>
                                <TableCell>{item_data.energyLabel}</TableCell>
                                <TableCell>{item_data.category}</TableCell>
                            </TableRow>
                        ))
                    }
                </TableBody>
            </Table>
        </div>
    )
}

export default ItemPage