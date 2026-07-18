import { z } from "zod";
import { ShoppingHistorySchema } from "./schemas";

export type ShoppingHistory = z.infer<typeof ShoppingHistorySchema>;
