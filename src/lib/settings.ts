import type { Pointer } from "./pointer";
import type { Template } from "./render/template";

export type RendererOverrides = {
	detailLevel?: number;
	debug: boolean;
	debugOutline: number;
	debugOutlineStripe: number;
	zoom: boolean;
};

export type DebugSettings = {
	render: RendererOverrides;
};

export type Settings = {
	debug: DebugSettings;
	heatmap: {
		enabled: boolean;
		duration: number;
		position: number;
		dimming: number;
	};
	template: {
		source: string;
	};
	input: {
		scrollSensitivity: number;
		dragVelocityAccumulation: number;
		dragVelocitySensitivity: number;
		dragVelocityFriction: number;
		bounceStrength: number;
	};
};

export interface AppState {
	pointer?: Pointer;
	adminOverrides: AdminOverrides;
	templates: Template[];
}

export type AdminOverrides = {
	mask: boolean;
	color: boolean;
	cooldown: boolean;
};
