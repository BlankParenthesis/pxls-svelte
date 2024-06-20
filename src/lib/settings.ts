import type { Template } from "./render/template";

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
