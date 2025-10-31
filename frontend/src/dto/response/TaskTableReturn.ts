import type {Priority} from "@/dto/Priority.ts";
import type {Status} from "@/dto/Status.ts";

export type TaskTableReturn = {
    id: string,
    taskSeriesId: string;
    name: string,
    items: string[],
    assignedTo: string[],
    priority: Priority,
    status: Status,
    dueDate: string,
    repetition: number,
    homeId: string
}