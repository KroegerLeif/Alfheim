import type {Address} from "@/dto/Address";

export type HomeTableReturnDTO = {
    name: string;
    address: Address;
    admin: string;
    numberTask: number;
    numberItems: number;
    members: [string];
}