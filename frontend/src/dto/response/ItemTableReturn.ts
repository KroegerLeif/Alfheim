import type {EnergyLabel} from "@/dto/EnergyLabel.ts";
import type {HomeListReturnDTO} from "@/dto/response/HomeListReturnDTO.ts";

export type ItemTableReturn ={
    id: string,
    name: string,
    energyLabel: EnergyLabel,
    category: string,
    homeData: HomeListReturnDTO
}
