import { Howl } from "howler";
import select from "../assets/select.aac";
import deselect from "../assets/deselect.aac";
import error from "../assets/error.aac";
import click from "../assets/click.aac";
import placeBegin from "../assets/place_begin.aac";
import placeOk from "../assets/place_ok.aac";
import cooldown from "../assets/cooldown.aac";

export enum Sound {
	Select,
	Deselect,
	Error,
	Click,
	PlaceBegin,
	PlaceOk,
	PlaceError,
	Cooldown,
}

const SOUNDS = {
	[Sound.Select]: new Howl({ src: select }),
	[Sound.Deselect]: new Howl({ src: deselect }),
	[Sound.Error]: new Howl({ src: error }),
	[Sound.Click]: new Howl({ src: click }),
	// [Sound.PlaceBegin]: new Howl({ src: placeBegin }),
	[Sound.PlaceOk]: new Howl({ src: placeOk }),
	[Sound.PlaceError]: new Howl({ src: error }),
	[Sound.Cooldown]: new Howl({ src: cooldown }),
} as Record<Sound, Howl>;

export function play(sound: Sound) {
	SOUNDS[sound]?.play();
}
