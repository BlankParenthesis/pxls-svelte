import { z } from "zod";
import { reference } from "./reference";
import { page } from "./page";

export const Faction = z.object({
	"name": z.string(),
	"created_at": z.number().int().min(0).transform(unix => new Date(unix * 1000)),
	"size": z.number(),
});
export type Faction = z.infer<typeof Faction>;

export const FactionReference = reference(Faction);
export const FactionsPage = page(FactionReference);