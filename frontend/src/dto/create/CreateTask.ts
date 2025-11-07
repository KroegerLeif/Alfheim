import type {Priority} from "@/dto/Priority.ts";

export type CreateTask = {
    name: string,
    items: string[],
    priority: Priority,
    dueDate: string,
    repetition: number,
    homeId: string
}