import type {Status} from "@/dto/Status.ts";

export type EditTask = {
    status: Status,
    dueDate: string
}