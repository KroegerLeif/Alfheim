"use client"

import type HomeTableReturnDTO from "@/dto/HomeTableReturnDTO.ts";
import type {ColumnDef} from "@tanstack/react-table";

export const columns: ColumnDef<HomeTableReturnDTO>[] = [
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "address",
        header: "Address",
    },
    {
        accessorKey: "admin",
        header: "Administrator",
    },
    {
        accessorKey: "numberTask",
        header: "Task-amount",
    },
    {
        accessorKey: "numberItems",
        header: "Items-amount",
    },
    {
        accessorKey: "members",
        header: "Members",
    },
]