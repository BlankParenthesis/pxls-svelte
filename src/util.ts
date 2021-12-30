/**
 * Wait until the page is about to render.
 * NOTE: Awaiting after this point will likely miss the frame.
 */
export function nextFrame(): Promise<DOMHighResTimeStamp> {
	return new Promise(resolve => requestAnimationFrame(resolve));
}