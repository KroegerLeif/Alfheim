import {columns} from "./columns"
import {DataTable} from "./data-table"
import axios from "axios";
import type {HomeTableReturnDTO} from "@/dto/HomeTableReturnDTO.ts";

async function getData(): Promise<HomeTableReturnDTO[]> {
    const res = await axios.get("api/home/")
                                .then(res => res.data)
                                .catch(err => console.log(err));
    if (!res.ok) {
        throw new Error('Failed to fetch data')
    }
    return res.json();
}

export default async function HomeTable() {
    const data = await getData()

    return (
        <div className="container mx-auto py-10">
            <DataTable columns={columns} data={data}/>
        </div>
    )
}