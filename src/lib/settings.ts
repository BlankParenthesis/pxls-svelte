import type { Template } from "./render/template";

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
}

/**
 * A utility class for single-shot message passing and response between two
 * places in the code which hold a reference to it.
 */
export class ActivationFinalizer {
	/**
	 * Call to signal that the activation should begin to end.
	 */
	readonly finalize: () => Promise<void>;
	/**
	 * Call to signal that the activation should begin to end with an error.
	 */
	readonly error: () => Promise<void>;
	/**
	 * Awaited on by the activation to obtain signals.
	 * When finalize is called this will resolve with a function to signal the 
	 * finalization is complete.
	 * When error is called this will reject with a function to signal the 
	 * finalization is complete.
	 */
	readonly poll: Promise<() => void>;
	
	constructor() {
		let begin: () => void;
		let error: () => void;
		let complete: () => void;
		
		const activationToCanvasResponsePromise = new Promise<void>(r => {
			complete = r as () => void;
		});
		const canvasToActivationMessagePromise = new Promise<() => void>((finalize, e) => {
			begin = () => finalize(complete);
			error = () => e(complete);
		});
		
		this.finalize = () => {
			begin();
			return activationToCanvasResponsePromise;
		};
		
		this.error = () => {
			error();
			return activationToCanvasResponsePromise;
		};

		this.poll = canvasToActivationMessagePromise;
	}
}

export interface Activation {
	type: string;
	background: string;
	position: number | undefined;
	finalizer: ActivationFinalizer;
	task: Promise<void>;
}

export interface Pointer {
	type: string;
	background: string;
	quickActivate: boolean;
	activate(position: number | undefined): Activation;
}

export interface PlacingPointer extends Pointer {
	type: "place";
	selected: number;
}

export interface LookupPointer extends Pointer {
	type: "lookup";
}

export interface AppState {
	pointer?: PlacingPointer | LookupPointer;
	adminOverrides: AdminOverrides;
	templates: Template[];
}

export type AdminOverrides = {
	mask: boolean;
	color: boolean;
	cooldown: boolean;
}
