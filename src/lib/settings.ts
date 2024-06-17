import type { Template } from "./canvas/template";

export type RenderSettings = {
	detailLevel: number;
	autoDetail: boolean;
	templates: Template[];
	timestampStart: number;
	timestampEnd: number;
	heatmapDim: number;
};

export type DebugSettings = {
	render: RenderSettings;
}

export type Settings = {
	debug: DebugSettings;
}
