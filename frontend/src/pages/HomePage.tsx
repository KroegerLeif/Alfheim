import {useEffect, useState} from "react";
import axios from "axios";

import type {HomeTableReturnDTO} from "@/dto/HomeTableReturnDTO.ts";

function HomePage(){

    const [homeTableData, setHomeTableData] = useState<HomeTableReturnDTO[]>([]);

    function loadHomeData(){
        axios.get("/api/home/")
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
            {
                homeTableData.map((home_data) => (
                    <h1 key={home_data.id}>{home_data.name}</h1>
                ))
            }
        </div>
    )
}

export default HomePage;