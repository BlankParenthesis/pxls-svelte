import type { Readable } from "svelte/store";
import type { Pixel } from "./pixel";

/**
 * A utility class for single-shot message passing and response between two
 * places in the code which hold a reference to it.
 */
export class ActivationFinalizer<T> {
	/**
	 * Call to signal that the activation should begin to end.
	 */
	readonly finalize: (data: T) => Promise<void>;
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
	readonly poll: Promise<{ data: T, complete: () => void }>;
	
	constructor() {
		let begin: (data: T) => void;
		let error: () => void;
		let complete: () => void;
		
		const activationToCanvasResponsePromise = new Promise<void>(r => {
			complete = r as () => void;
		});
		const canvasToActivationMessagePromise = new Promise<{ data: T, complete: () => void }>((finalize, e) => {
			begin = data => finalize({ data, complete });
			error = () => e(complete);
		});
		
		this.finalize = (data: T) => {
			begin(data);
			return activationToCanvasResponsePromise;
		};
		
		this.error = () => {
			error();
			return activationToCanvasResponsePromise;
		};

		this.poll = canvasToActivationMessagePromise;
	}
}

export interface BaseActivation<T = unknown> {
	type: string;
	position: number | undefined;
	finalizer: ActivationFinalizer<T>;
	task: Promise<T>;
}

export interface PlaceActivation extends BaseActivation<Pixel> {
	type: "place";
	color: string;
}

export interface LookupData {
	dismissal: Promise<void>;
	lookup: Readable<Promise<Pixel | undefined> | undefined>;
}
export interface LookupActivation extends BaseActivation<LookupData> {
	type: "lookup";
}

export type Activation = PlaceActivation | LookupActivation;

export interface BasePointer {
	type: string;
	quickActivate: boolean;
	activate(position: number | undefined): Activation;
}

export interface PlacingPointer extends BasePointer {
	type: "place";
	selected: number;
	color: string;
	activate(position: number | undefined): PlaceActivation;
}

export interface LookupPointer extends BasePointer {
	type: "lookup";
	activate(position: number | undefined): LookupActivation;
}

export type Pointer = PlacingPointer | LookupPointer;
