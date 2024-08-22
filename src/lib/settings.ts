export type RendererOverrides = {
	detailLevel?: number;
	debug: boolean;
	debugOutline: number;
	debugOutlineStripe: number;
	zoom: boolean,
};

export type DebugSettings = {
	render: RendererOverrides;
}

export type Settings = {
	debug: DebugSettings;
}

export interface AppState {
	selectedColor?: number;
	adminOverrides: AdminOverrides;
}

export type AdminOverrides = {
	mask: boolean,
	color: boolean,
	cooldown: boolean,
}
