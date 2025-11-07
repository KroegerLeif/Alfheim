import type {EnergyLabel} from "@/dto/EnergyLabel.ts";

export type CreateItem = {
    name: string,
    energyLabel: EnergyLabel,
    category: string
    homeId: string
}