import type {EnergyLabel} from "@/dto/EnergyLabel.ts";

export type ItemTableReturn ={
    id: string,
    name: string,
    energyLabel: EnergyLabel,
    category: string,
    homeId: string
}
