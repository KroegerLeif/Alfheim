import type {ItemTableReturn} from "@/dto/response/ItemTableReturn.ts";
import {DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog.tsx";
import {Button} from "@/components/ui/button.tsx";
import ItemSettings from "@/pages/item/ItemSettings.tsx";


function ItemInfo(props: Readonly<ItemTableReturn & { loadItemData: () => void }>){
    const {name, energyLabel, category, homeData} = props;
    const {loadItemData} = props;

    return(
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {name}
                </DialogTitle>
                <DialogDescription>
                    Manage item details
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
                EnergyLabel: {energyLabel} <br/>
                Category: {category} <br/>
                Home: {homeData.name}
            </div>
            <DialogFooter>
                <ItemSettings {...props} loadItemData={loadItemData}/>
                <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </>
    )

}
export default ItemInfo;