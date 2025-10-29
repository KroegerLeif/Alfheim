import {useEffect, useState} from "react";
import axios from "axios";

import type {HomeTableReturnDTO} from "@/dto/response/HomeTableReturnDTO.ts";
import CreateNewHome from "@/components/create/CreateNewHome.tsx";

import HomeCard from "@/components/HomeCard.tsx";

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
        <div className={"flex flex-col justify-center items-center"}>
            <div className={"flex flex-row"}>
                <h1>Home Overview</h1>
                <CreateNewHome/>
            </div>
            <div className={"flex flex-row flex-wrap"}>
                {
                    homeTableData.map((home_data) => (
                        <div>
                            <HomeCard {...home_data} loadHomeData={loadHomeData} />
                        </div>
                    ))
                }
            </div>
        </div>
    )
}

export default HomePage;