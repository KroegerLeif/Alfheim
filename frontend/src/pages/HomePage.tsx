import {useEffect, useState} from "react";
import axios from "axios";

import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import type {HomeTableReturnDTO} from "@/dto/HomeTableReturnDTO.ts";
import CreateNewHome from "@/components/CreateNewHome.tsx";
import EditHome from "@/components/EditHome.tsx";

function HomePage(){

    const [homeTableData, setHomeTableData] = useState<HomeTableReturnDTO[]>([]);

    function loadHomeData(){
        axios.get("/api/home")
            .then((response) =>
                {setHomeTableData(response.data);})
            .catch((error) => {console.log(error)})
    }

    useEffect(() => {
        loadHomeData();
    }, []);

    return(
        <div className="homePage">
            <h1>Home Overview</h1>
            <Table>
                <TableCaption>A list of all Homes</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Name</TableHead>
                        <TableHead>Number Task</TableHead>
                        <TableHead>Number Items</TableHead>
                        <TableHead>Members</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                        {
                            homeTableData.map((home_data) => (
                                <TableRow key={home_data.id}>
                                    <TableCell className="font-medium">{home_data.name}</TableCell>
                                    <TableCell>{home_data.numberTask}</TableCell>
                                    <TableCell>{home_data.numberItems}</TableCell>
                                    <TableCell>{home_data.members}</TableCell>
                                    <TableCell>
                                        <EditHome id={home_data.id} name={home_data.name} address={home_data.address}/>
                                    </TableCell>
                                </TableRow>
                            ))
                        }
                </TableBody>
            </Table>
            <CreateNewHome/>
        </div>
    )
}

export default HomePage;