import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import type {HomeTableReturnDTO} from "@/dto/response/HomeTableReturnDTO.ts";
import HomeInfo from "@/pages/home/HomeInfo.tsx";
import {Dialog, DialogContent, DialogTrigger} from "@/components/ui/dialog.tsx";


function HomeCard({id, name, address, numberTask, numberItems, members, loadHomeData}: Readonly<HomeTableReturnDTO & { loadHomeData: () => void }>){

    return(
        <Dialog>
            <DialogTrigger asChild>
                <Card key={id}
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                >
                    <CardHeader>
                        <CardTitle>{name}</CardTitle>
                        <CardDescription>House Description</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Number Task: {numberTask}</p>
                        <p>Number Items: {numberItems}</p>
                        <p>Number Members: {members}</p>
                    </CardContent>
                    <CardFooter>
                        Click on card to see more details
                    </CardFooter>
                </Card>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh]">
                <HomeInfo id={id} name={name} address={address} numberTask={numberTask} numberItems={numberItems}
                          members={members} loadHomeData={loadHomeData} admin={""} />
            </DialogContent>
        </Dialog>
    )

}

export default HomeCard;