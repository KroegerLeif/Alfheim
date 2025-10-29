import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {Button} from "@/components/ui/button.tsx";
import EditHome from "@/components/EditHome.tsx";
import type {HomeTableReturnDTO} from "@/dto/response/HomeTableReturnDTO.ts";
import axios from "axios";

function HomeCard({id, name, address, numberTask, numberItems, members, loadHomeData}: Readonly<HomeTableReturnDTO & { loadHomeData: () => void }>){

    function deleteHome(id:string){
        axios.delete("/api/home/" + id + "/delete")
            .then(() => {loadHomeData();})
            .catch((error) => {console.log(error)})
    }

    return(
        <Card>
            <CardHeader>
                <CardTitle>{name}</CardTitle>
                <CardDescription>House Descripiton</CardDescription>
                <CardAction>Card Action</CardAction>
            </CardHeader>
            <CardContent>
                <p>Number Task: {numberTask}</p>
                <p>Number Items: {numberItems}</p>
                <p>Number Members: {members}</p>
            </CardContent>
            <CardFooter>
                <Button onClick={() => deleteHome(id)} variant={"destructive"}>Delete</Button>
                <EditHome id={id} name={name} address={address}/>
            </CardFooter>
        </Card>
    )

}

export default HomeCard;