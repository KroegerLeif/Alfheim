import type {Priority} from "@/dto/Priority.ts";
import type {Status} from "@/dto/Status.ts";

export type TaskTableReturn = {
    id: string,
    name: string,
    items: string[],
    assignedTo: string[],
    priority: Priority,
    status: Status,
    dueDate: string,
}