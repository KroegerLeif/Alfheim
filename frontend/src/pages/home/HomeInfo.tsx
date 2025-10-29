import {
    DialogClose,
    DialogDescription, DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import HomeSettings from "@/pages/home/HomeSettings.tsx";
import { Button } from "@/components/ui/button";
import type {HomeTableReturnDTO} from "@/dto/response/HomeTableReturnDTO.ts";

function HomeInfo({id, name, address, numberTask, numberItems, members, loadHomeData}: Readonly<HomeTableReturnDTO & { loadHomeData: () => void }>) {
    return(
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {name}
                </DialogTitle>
                <DialogDescription>
                    Manage property details and household members
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
                number of tasks: {numberTask} <br/>
                number of items: {numberItems} <br/>
                members: {members} <br/>
                address: {address.street} {address.postCode} {address.city} {address.country} <br/>
            </div>
            <DialogFooter>
                <HomeSettings id={id} name={name} address={address} loadHomeData={loadHomeData}/>
                <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </>
    )
}

export default HomeInfo;