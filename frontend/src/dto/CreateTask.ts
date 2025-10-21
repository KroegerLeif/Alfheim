import type {Item} from "@/dto/Item.ts";
import type {Priority} from "@/dto/Priority.ts";

export type CreateTask = {
    name: string,
    items: Item[],
    priority: Priority,
    dueDate: "dd/mm/yyyy",
    repetition: number
}