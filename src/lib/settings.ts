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
	heatmap: {
		enabled: boolean;
		duration: number;
		position: number;
		dimming: number;
	};
}

export interface Pointer {
	type: string,
	background: string;
	activate(x: number, y: number): Promise<void>;
}

export interface PlacingPointer extends Pointer {
	type: "place",
	selected: number;
}

export interface LookupPointer extends Pointer {
	type: "lookup",
}

export interface AppState {
	pointer?: PlacingPointer | LookupPointer;
	adminOverrides: AdminOverrides;
}

export type AdminOverrides = {
	mask: boolean;
	color: boolean;
	cooldown: boolean;
}
