import type { Palette } from "../palette";
import type { Shape } from "../shape";

export interface Permissions {
	"info": boolean;
	"boards.list": boolean;
	"boards.post": boolean;
	"boards.get": boolean;
	"boards.patch": boolean;
	"boards.delete": boolean;
	"socket.core": boolean;
	"boards.data.get": boolean;
	"boards.data.patch": boolean;
	"boards.users": boolean;
	"boards.pixels.list": boolean;
	"boards.pixels.get": boolean;
	"boards.pixels.post": boolean;
}

export interface BoardInfo {
	name: string;
	shape: Shape;
	palette: Palette;
	maxPixelsAvailable: number;
	// Not exposed by the old Pxls API.
	createdAt: Date | null;
}

export interface BoardUsersInfo {
	/**
	 * Number of currently active users.
	 */
	active: number;
	/**
	 * Time since last user activity until that user is considered inactive in seconds.
	 */
	idleTimeout: number | null;
}

export interface BoardChoice {
	connect(): Promise<Board>;
	info(): Promise<BoardInfo>;
}

export interface Backend {
	availableBoards(): AsyncGenerator<BoardChoice>;
	permissions(): Promise<Permissions>;
}

export interface Placement {
	position: number;
	color: number;
	modified: Date;
}

export interface Change {
	position: number;
	values: number[];
}

type BoardInfoUpdate = Partial<BoardInfo>;
interface BoardDataUpdate {
	colors?: Change[];
	timestamps?: Change[];
	initial?: Change[];
	mask?: Change[];
}

export interface BoardUpdate {
	info?: BoardInfoUpdate;
	data?: BoardDataUpdate;
}

export interface PixelsAvailable {
	count: number;
	/**
	 * Unix Timestamp of next available.
	 * `undefined` if `count == maxPixelsAvailable` or not supported by backend.
	 */
	next?: number;
}

export type OnEventArguments = ["board_update", (data: BoardUpdate) => void] | ["pixels_available", (data: PixelsAvailable) => void];
export type EmitEventArguments = ["board_update", BoardUpdate] | ["pixels_available", PixelsAvailable];

export interface Board {
	on(event: "board_update", callback: (data: BoardUpdate) => void);
	on(event: "pixels_available", callback: (data: PixelsAvailable) => void);

	info(): Promise<BoardInfo>;
	users(): Promise<BoardUsersInfo>;
	pixels(): AsyncGenerator<Placement>;
	lookup(position: number): Promise<Placement | null>;
	place(position: number, color: number): Promise<Placement>;

	colors(sectorIndices: number[]): Promise<Uint8Array[]>;
	timestamps(sectorIndices: number[]): Promise<Uint32Array[]>;
	mask(sectorIndices: number[]): Promise<Uint8Array[]>;
	// Not exposed by the old Pxls API.
	initial(sectorIndices: number[]): Promise<Uint8Array[]> | null;
}