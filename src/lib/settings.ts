import { z } from "zod";
import type { Pointer } from "./pointer";
import templateStyleDefault from "../assets/template_style_dotted_1_1.webp";

// let settings: Settings = {
// 	heatmap: {
// 		enabled: false,
// 		duration: 3600, // one hour
// 		position: -1, // "now" (`-1 + 1` seconds ago)
// 		dimming: 0.75,
// 	},
// 	template: {
// 		style: templateStyleSource,
// 	},
// 	input: {
// 		scrollSensitivity: 1.15,
// 		dragVelocityAccumulation: 200,
// 		dragVelocitySensitivity: 0.96,
// 		dragVelocityFriction: 1 - 1 / 250,
// 		bounceStrength: 1 / 5000,
// 	},
// };
export const Settings = z.object({
	heatmap: z.object({
		enabled: z.boolean().default(false),
		duration: z.number().default(3600), // one hour
		position: z.number().default(-1), // "now" (`-1 + 1` seconds ago)
		dimming: z.number().min(0).max(1).catch(0.75),
	}).default({}),
	template: z.object({
		style: z.string().default(templateStyleDefault),
	}).default({}),
	input: z.object({
		scrollSensitivity: z.number().default(1.15),
		dragVelocityAccumulation: z.number().default(200),
		dragVelocitySensitivity: z.number().default(0.96),
		dragVelocityFriction: z.number().default(1 - 1 / 250),
		bounceStrength: z.number().default(1 / 5000),
	}).default({}),
}).default({});
export type Settings = z.infer<typeof Settings>;

export interface AppState {
	pointer?: Pointer;
	adminOverrides: AdminOverrides;
}

export type AdminOverrides = {
	mask: boolean;
	color: boolean;
	cooldown: boolean;
};
