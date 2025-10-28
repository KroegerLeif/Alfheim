import type {Address} from "@/dto/Address.ts";

export type HomeTableReturnDTO = {
    id: string;
    name: string;
    address: Address;
    admin: string;
    numberTask: number;
    numberItems: number;
    members: [string];
}