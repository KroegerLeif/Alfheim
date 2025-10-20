import type Address from "@/dto/Address.ts";

type HomeTableReturnDTO = {
    name: string;
    adress: Address;
    admin: string;
    numberTask: number;
    numberItems: number;
    members: [string];
}

export default HomeTableReturnDTO;