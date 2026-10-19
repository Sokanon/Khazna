import { registerSW } from "virtual:pwa-register";
import i18n from "../i18n";
import { trackEvent } from "./analytics";
import { showToast } from "./toast";

/** Where Khazna is being viewed from, which decides what "Install" can do there. */
export type InstallPlatform =
	| "ios" // Safari on iPhone and iPad: Share, then Add to Home Screen
	| "ios-other" // Chrome, Edge, Firefox… on iOS: the same, from their own share menu
	| "android" // an Android browser without its own prompt: the browser menu
	| "mac-safari" // Safari on a Mac: File, then Add to Dock
	| "in-app" // a social app's built-in browser, which can't install anything
	| "desktop"; // everything else: the browser's own prompt, when it offers one

export interface PwaState {
	/** Running as the installed app. */
	standalone: boolean;
	/** Installed already and opened in a browser tab (Chromium tells us, others don't). */
	installed: boolean;
	platform: InstallPlatform;
	/** The browser handed over its install prompt. */
	canPrompt: boolean;
	installSheetOpen: boolean;
	updateReady: boolean;
}

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
	interface Navigator {
		standalone?: boolean;
		getInstalledRelatedApps?: () => Promise<unknown[]>;
	}
}

const UA = navigator.userAgent;
// iPadOS presents itself as a Mac, so touch support is the tell.
export const IS_IOS =
	/iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const IN_APP_BROWSER =
	/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Snapchat|TikTok|BytedanceWebview|musical_ly|LinkedInApp|Line\/|GSA\/|; wv\)/;

function detectPlatform(): InstallPlatform {
	// iOS webviews leave "Safari" out of the user agent.
	if (IN_APP_BROWSER.test(UA) || (IS_IOS && !/Safari\//.test(UA))) return "in-app";
	if (IS_IOS) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(UA) ? "ios-other" : "ios";
	if (/Android/.test(UA)) return "android";
	const safari = UA.match(/Version\/(\d+).*Safari\//);
	if (
		/Macintosh/.test(UA) &&
		safari &&
		Number(safari[1]) >= 17 &&
		!/Chrome|Chromium|Edg|OPR|Firefox/.test(UA)
	) {
		return "mac-safari";
	}
	return "desktop";
}

const standaloneQuery = window.matchMedia("(display-mode: standalone)");

function isStandalone(): boolean {
	return standaloneQuery.matches || navigator.standalone === true;
}

let state: PwaState = {
	standalone: isStandalone(),
	installed: false,
	platform: detectPlatform(),
	canPrompt: false,
	installSheetOpen: false,
	updateReady: false,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<PwaState>): void {
	state = { ...state, ...patch };
	for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getPwaState(): PwaState {
	return state;
}

/** Whether there is anything useful behind an "Install" button here. */
export function canInstall(current: PwaState): boolean {
	if (current.standalone || current.installed) return false;
	return current.canPrompt || current.platform !== "desktop";
}

// ─── Install ───

let deferredPrompt: BeforeInstallPromptEvent | null = null;

type InstallOutcome = "accepted" | "dismissed" | "unavailable";

async function promptInstall(source: string): Promise<InstallOutcome> {
	const prompt = deferredPrompt;
	if (!prompt) return "unavailable";
	try {
		await prompt.prompt();
	} catch {
		return "unavailable";
	}
	// A prompt is spent once shown; Chromium hands over a new one if it may ask again.
	deferredPrompt = null;
	setState({ canPrompt: false });
	const { outcome } = await prompt.userChoice;
	trackEvent("app_install_prompt", { outcome, source });
	return outcome;
}

/** The browser's own install prompt where there is one, the steps for this browser where there isn't. */
export async function startInstall(source: string): Promise<InstallOutcome> {
	const outcome = await promptInstall(source);
	if (outcome === "unavailable") setState({ installSheetOpen: true });
	return outcome;
}

export function closeInstallSheet(): void {
	setState({ installSheetOpen: false });
}

// ─── Updates ───

// A new version found this early, before any tap, is applied straight away: one quick reload at launch.
const LAUNCH_GRACE_MS = 6000;
const LOOK_EVERY_MS = 30 * 60 * 1000;
const LOOK_AT_MOST_MS = 60 * 1000;
// iOS doesn't always report the new worker taking over, so the reload has a fallback,
// and an update that didn't take is only retried silently once in a while.
const APPLY_WAIT_MS = 4000;
const RETRY_AFTER_MS = 10 * 60 * 1000;
const UPDATE_TRIED_KEY = "khazna-update-tried";

let updateServiceWorker: (() => Promise<void>) | undefined;
let registration: ServiceWorkerRegistration | undefined;
let touched = false;
let lookedAt = 0;
let reloading = false;

function reloadOnce(): void {
	if (reloading) return;
	reloading = true;
	window.location.reload();
}

function triedRecently(): boolean {
	try {
		return Date.now() - Number(sessionStorage.getItem(UPDATE_TRIED_KEY)) < RETRY_AFTER_MS;
	} catch {
		return false;
	}
}

export function applyUpdate(): void {
	if (!updateServiceWorker) return;
	try {
		sessionStorage.setItem(UPDATE_TRIED_KEY, String(Date.now()));
	} catch {
		// Private mode: the retry guard just doesn't persist.
	}
	updateServiceWorker();
	window.setTimeout(reloadOnce, APPLY_WAIT_MS);
}

function offerUpdate(): void {
	if (!touched && performance.now() < LAUNCH_GRACE_MS && !triedRecently()) {
		applyUpdate();
		return;
	}
	setState({ updateReady: true });
}

function lookForUpdate(): void {
	if (!registration || document.visibilityState !== "visible" || !navigator.onLine) return;
	if (Date.now() - lookedAt < LOOK_AT_MOST_MS) return;
	lookedAt = Date.now();
	registration.update().catch(() => {});
}

/** "Check for updates" in Settings: asks for a new version now and waits for it to arrive. */
export async function checkForUpdate(): Promise<"ready" | "current" | "unavailable"> {
	if (state.updateReady) return "ready";
	if (!registration || !navigator.onLine) return "unavailable";
	try {
		await registration.update();
	} catch {
		return "unavailable";
	}
	lookedAt = Date.now();
	// A new version installs in the background, then reports itself through offerUpdate.
	for (let waited = 0; waited < 8000 && registration.installing; waited += 250) {
		await new Promise((resolve) => window.setTimeout(resolve, 250));
	}
	await new Promise((resolve) => window.setTimeout(resolve, 250));
	return state.updateReady ? "ready" : "current";
}

function registerServiceWorker(): void {
	// Built assets only: a worker from the dev server would outlive it on localhost.
	if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

	updateServiceWorker = registerSW({
		onNeedRefresh: offerUpdate,
		onNeedReload: reloadOnce,
		onOfflineReady() {
			// The first launch of the installed app is when this is news.
			if (state.standalone) showToast(i18n.t("pwa.offlineReady"));
		},
		onRegisteredSW(_url, swRegistration) {
			if (!swRegistration) return;
			registration = swRegistration;
			lookedAt = Date.now();
			window.setInterval(lookForUpdate, LOOK_EVERY_MS);
		},
	});
}

// ─── Startup ───

function syncStandalone(): void {
	const standalone = isStandalone();
	document.documentElement.classList.toggle("is-standalone", standalone);
	setState({ standalone });
}

export function startPwa(): void {
	syncStandalone();
	// Installing from a desktop tab moves that tab into the app window without a reload.
	standaloneQuery.addEventListener?.("change", syncStandalone);

	// The launch animation (index.html) leaves the page once it has played, or straight away
	// when there's nothing to play.
	const splash = document.getElementById("splash");
	if (splash && !document.documentElement.classList.contains("splash")) splash.remove();
	splash?.addEventListener("animationend", (event) => {
		if (event.target !== splash) return;
		splash.remove();
		document.documentElement.classList.remove("splash");
	});

	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferredPrompt = event as BeforeInstallPromptEvent;
		setState({ canPrompt: true });
	});

	window.addEventListener("appinstalled", () => {
		deferredPrompt = null;
		setState({ canPrompt: false, installSheetOpen: false, installed: true });
		trackEvent("app_installed", { platform: state.platform });
		showToast(i18n.t("pwa.installed"));
	});

	navigator
		.getInstalledRelatedApps?.()
		.then((apps) => {
			if (apps.length > 0) setState({ installed: true });
		})
		.catch(() => {});

	for (const type of ["pointerdown", "keydown"]) {
		window.addEventListener(type, () => (touched = true), { once: true, capture: true });
	}
	document.addEventListener("visibilitychange", lookForUpdate);

	window.addEventListener("offline", () => {
		showToast(i18n.t("pwa.offline"), { icon: "offline" });
	});
	window.addEventListener("online", () => {
		showToast(i18n.t("pwa.online"), { icon: "online" });
		lookForUpdate();
	});
	if (!navigator.onLine) {
		window.setTimeout(() => showToast(i18n.t("pwa.offline"), { icon: "offline" }), 1500);
	}

	// Keeps the browser from clearing the offline copy of an installed app under storage pressure.
	if (state.standalone) navigator.storage?.persist?.().catch(() => {});

	registerServiceWorker();
}
