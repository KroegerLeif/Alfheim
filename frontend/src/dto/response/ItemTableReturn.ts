import type {EnergyLabel} from "@/dto/EnergyLabel.ts";
import type {HomeListReturnDTO} from "@/dto/response/HomeListReturnDTO.ts";
import type {TaskListReturn} from "@/dto/response/TaskListReturn.ts";

export type ItemTableReturn ={
    id: string,
    name: string,
    energyLabel: EnergyLabel,
    category: string,
    tasks: TaskListReturn[],
    homeData: HomeListReturnDTO
}
