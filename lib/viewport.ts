import { getPwaState, IS_IOS } from "./pwa";

// iOS 26 sometimes leaves the installed app's view shorter than the screen (WebKit bugs 313800,
// 322900, 323403): at launch, after the keyboard closes and on coming back to the app. Fixed
// things such as the tab bar then sit where the bottom of that short view is, mid-screen. A page
// that scrolls makes iOS give the view back, so when it's short the page is scrolled by a pixel
// and back, then by a bit more. Adapted from Rihla's resources/js/pwa.js.

const root = document.documentElement;
const visual = window.visualViewport;
const coarse = window.matchMedia("(pointer: coarse)");
const TEXT_FIELD =
	'input:not([type=checkbox],[type=radio],[type=range],[type=button],[type=submit],[type=file]), textarea, [contenteditable="true"]';

// The keyboard is up while a text field has focus on a touch screen (viewport sizes can't be
// trusted for this on iOS 26: they're what goes stale).
const typing = (): boolean =>
	coarse.matches &&
	document.activeElement instanceof Element &&
	document.activeElement.matches(TEXT_FIELD);

const frames = (count: number): Promise<void> =>
	new Promise((done) => {
		const next = (): void => {
			if (count-- > 0) requestAnimationFrame(next);
			else done();
		};
		next();
	});
const wait = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));

// The tallest the view has been at each width with no keyboard up (on its side, with no status bar).
const fullHeight: Record<number, number> = {};
function noteFullHeight(): void {
	if (typing()) return;
	fullHeight[window.innerWidth] = Math.max(fullHeight[window.innerWidth] ?? 0, window.innerHeight);
}

function isShort(): boolean {
	if (!visual || typing() || !coarse.matches || !getPwaState().standalone) return false;
	// Pinch-zoomed in, the visual viewport is meant to be smaller.
	if (Math.abs(visual.scale - 1) > 0.01) return false;
	const upright =
		window.innerWidth === window.screen.width && window.screen.height > window.screen.width;
	// Upright, the view reaches from under the status bar (62pt at most) to the bottom of the
	// screen. Not the tallest it has been: at launch iOS lays the page out at the whole screen's
	// height for a moment, before the status bar takes its place.
	const expected = upright ? window.screen.height - 70 : (fullHeight[window.innerWidth] ?? 0);
	return (
		window.innerHeight < expected - 4 ||
		visual.offsetTop > 1 ||
		visual.height < window.innerHeight - 4
	);
}

// The page is made taller than the screen for a moment and scrolled by `by` and back, a couple of
// frames apart (iOS has to see a page that really scrolls). At the bottom it scrolls up instead.
async function nudge(by: number): Promise<void> {
	const y = window.scrollY;
	root.classList.add("vv-room");
	try {
		await frames(2);
		const room = root.scrollHeight - window.innerHeight;
		window.scrollTo(0, y + by <= room ? y + by : Math.max(0, y - by));
		await frames(2);
		window.scrollTo(0, y);
		await wait(200);
	} finally {
		root.classList.remove("vv-room");
	}
}

let settling = false;
let failedRounds = 0;

/** Gives the view back if iOS left it short. At most two rounds a page end still short. */
export async function settleViewport(delay = 0): Promise<void> {
	if (!IS_IOS || !visual || settling || failedRounds >= 2) return;
	settling = true;
	try {
		await wait(delay);
		if (document.visibilityState !== "visible" || !isShort()) return;
		for (const by of [1, 48]) {
			if (typing()) return;
			await nudge(by);
			await wait(300);
			if (!isShort()) return;
		}
		failedRounds++;
	} finally {
		settling = false;
	}
}

/** When iOS may leave the view short: launch, the keyboard closing, coming back, a resize. */
export function watchViewport(): void {
	if (!IS_IOS || !visual) return;
	noteFullHeight();
	window.addEventListener("load", () => {
		settleViewport(300);
		window.setTimeout(() => settleViewport(), 1500);
	});
	// iOS 26 shrank the view about 0.8s after coming back to the app (WebKit bug 323322).
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") settleViewport(900);
	});
	document.addEventListener("focusout", () => {
		window.setTimeout(() => {
			if (!typing()) settleViewport(600);
		}, 0);
	});
	let resized = 0;
	window.addEventListener("resize", () => {
		noteFullHeight();
		window.clearTimeout(resized);
		resized = window.setTimeout(() => {
			if (!typing()) settleViewport();
		}, 200);
	});
}
