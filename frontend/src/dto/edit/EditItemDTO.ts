import type {EnergyLabel} from "@/dto/EnergyLabel.ts";

export type EditItemDTO = {
    name: string,
    category: string,
    energyLabel: EnergyLabel,
}