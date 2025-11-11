import type {ItemTableReturn} from "@/dto/response/ItemTableReturn.ts";
import {DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog.tsx";
import {Button} from "@/components/ui/button.tsx";
import ItemSettings from "@/pages/item/ItemSettings.tsx";
import {Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table.tsx";


function ItemInfo(props: Readonly<ItemTableReturn & { loadItemData: () => void }>){
    const {name, energyLabel, category, homeData,tasks} = props;
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
                <br/>
                Tasks:
                <Table className={"bg-blue-200 rounded"}>
                    <TableCaption>A list of related Task</TableCaption>
                    <TableHeader>
                        <TableHead>Name</TableHead>
                        <TableHead>Due Date</TableHead>
                    </TableHeader>
                    <TableBody>
                        {tasks.map((task) => (
                            <TableRow>
                                <TableCell>{task.name}</TableCell>
                                <TableCell>{task.dueDate}</TableCell>
                            </TableRow>
                            )
                        )}
                    </TableBody>
                </Table>
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