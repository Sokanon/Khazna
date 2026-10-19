import { Check, Copy, Share, SquarePlus, X } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { usePwa } from "../hooks/usePwa";
import { useSound } from "../hooks/useSound";
import { useSwipe } from "../hooks/useSwipe";
import { useUIContext } from "../hooks/useUIContext";
import { canInstall, closeInstallSheet, type InstallPlatform, startInstall } from "../lib/pwa";
import { showToast } from "../lib/toast";
import { cn } from "../lib/utils";

const DAY = 24 * 60 * 60 * 1000;
// How long "Not now" holds after the first and second time. After the third, only the menu offers it.
const SNOOZE_DAYS = [14, 60];
const SNOOZE_KEY = "khazna-install-snooze";
const VISITS_KEY = "khazna-visits";
const SESSION_KEY = "khazna-session";
const SHOWN_KEY = "khazna-install-banner-shown";

function readStorage<T>(read: () => T, fallback: T): T {
	try {
		return read();
	} catch {
		return fallback;
	}
}

// Counted once per browser session; a returning visitor needs less convincing.
const visits = readStorage(() => {
	const count = Number(localStorage.getItem(VISITS_KEY)) || 0;
	if (sessionStorage.getItem(SESSION_KEY)) return count;
	sessionStorage.setItem(SESSION_KEY, "1");
	localStorage.setItem(VISITS_KEY, String(count + 1));
	return count + 1;
}, 1);

function isSnoozed(): boolean {
	return readStorage(() => {
		const { count, at } = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? '{"count":0,"at":0}');
		if (count === 0) return false;
		const days = SNOOZE_DAYS[count - 1];
		return days === undefined || Date.now() - at < days * DAY;
	}, false);
}

function snooze(): void {
	try {
		const { count } = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? '{"count":0}');
		localStorage.setItem(SNOOZE_KEY, JSON.stringify({ count: count + 1, at: Date.now() }));
	} catch {
		// Private mode: "Not now" lasts for this visit only.
	}
}

/**
 * Suggests the app once on a phone or tablet, after someone has actually used Khazna (opened a
 * couple of logos or app galleries) and only at a pause, never over what they are doing.
 */
export function InstallBanner(): JSX.Element | null {
	const pwa = usePwa();
	const { selectedItem, isSearchOpen } = useUIContext();
	const { pathname } = useLocation();
	const { t } = useTranslation();
	const play = useSound();
	const [opens, setOpens] = useState(0);
	const [visible, setVisible] = useState(false);
	const swipe = useSwipe({
		axis: "y",
		distance: 40,
		onSwipe: (direction) => {
			if (direction === "down") dismiss();
		},
	});

	useEffect(() => {
		if (selectedItem) setOpens((count) => count + 1);
	}, [selectedItem]);

	useEffect(() => {
		if (pathname.startsWith("/apps/")) setOpens((count) => count + 1);
	}, [pathname]);

	const eligible =
		canInstall(pwa) &&
		pwa.platform !== "in-app" &&
		!pwa.updateReady &&
		!pwa.installSheetOpen &&
		window.matchMedia("(pointer: coarse)").matches;
	const engaged = opens >= (visits > 1 ? 1 : 2);
	const atPause = !selectedItem && !isSearchOpen;

	useEffect(() => {
		if (!eligible || !engaged || !atPause || visible) return;
		if (isSnoozed() || readStorage(() => sessionStorage.getItem(SHOWN_KEY) !== null, false)) return;
		const timer = window.setTimeout(() => {
			readStorage(() => sessionStorage.setItem(SHOWN_KEY, "1"), undefined);
			setVisible(true);
		}, 800);
		return () => window.clearTimeout(timer);
	}, [eligible, engaged, atPause, visible]);

	function dismiss(): void {
		play("swipe");
		snooze();
		setVisible(false);
	}

	async function install(): Promise<void> {
		play("tap");
		setVisible(false);
		if ((await startInstall("banner")) !== "accepted") snooze();
	}

	if (!visible || !eligible) return null;

	return (
		<section
			aria-label={t("pwa.bannerTitle")}
			{...swipe.handlers}
			style={{ transform: `translateY(${Math.max(0, swipe.offset.y)}px)` }}
			className={cn(
				"fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[45] mx-auto max-w-md touch-none animate-in fade-in slide-in-from-bottom-6 duration-300",
				!swipe.dragging && "transition-transform",
			)}
		>
			<div className="flex items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-2xl shadow-black/20 backdrop-blur-md">
				<img
					src="/apple-touch-icon.png"
					alt=""
					width={44}
					height={44}
					className="size-11 shrink-0 rounded-[22%]"
				/>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold text-primary">{t("pwa.bannerTitle")}</p>
					<p className="text-xs leading-snug text-muted-foreground">{t("pwa.bannerText")}</p>
				</div>
				<button
					type="button"
					onClick={install}
					className="shrink-0 rounded-full bg-accent-bg px-4 py-2 text-sm font-semibold text-accent-text"
				>
					{t("pwa.install")}
				</button>
				<button
					type="button"
					onClick={dismiss}
					aria-label={t("pwa.notNow")}
					className="-me-1 shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-primary"
				>
					<X size={18} />
				</button>
			</div>
		</section>
	);
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const STEPS_TEXT: Partial<Record<InstallPlatform, string>> = {
	"ios-other": "pwa.iosOther",
	android: "pwa.android",
	"mac-safari": "pwa.macSafari",
	desktop: "pwa.desktop",
};

function Step({
	number,
	icon,
	children,
}: {
	number: number;
	icon: ReactNode;
	children: ReactNode;
}) {
	return (
		<li className="flex items-center gap-3 py-3">
			<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold tabular-nums text-primary">
				{number}
			</span>
			<span className="flex-1 text-sm leading-relaxed text-primary">{children}</span>
			<span className="shrink-0 text-muted-foreground" aria-hidden>
				{icon}
			</span>
		</li>
	);
}

/** How to install, for the browser in hand: the real prompt where there is one, the steps where there isn't. */
export function InstallSheet(): JSX.Element | null {
	const { installSheetOpen, standalone, platform, canPrompt } = usePwa();
	const { t } = useTranslation();
	const play = useSound();
	const titleId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const [leaving, setLeaving] = useState(false);
	const open = installSheetOpen && !standalone;

	function close(): void {
		setLeaving(true);
		window.setTimeout(() => {
			setLeaving(false);
			closeInstallSheet();
		}, 200);
	}

	const swipe = useSwipe({
		axis: "y",
		onSwipe: (direction) => {
			if (direction === "down") close();
		},
	});

	useEffect(() => {
		if (!open) return;
		const opener = document.activeElement as HTMLElement | null;
		const panel = panelRef.current;
		(
			panel?.querySelector<HTMLElement>("[data-autofocus]") ??
			panel?.querySelector<HTMLElement>(FOCUSABLE)
		)?.focus();
		const root = document.documentElement;
		const overflow = root.style.overflow;
		root.style.overflow = "hidden";

		function onKeyDown(event: KeyboardEvent): void {
			if (event.key === "Escape") {
				event.preventDefault();
				closeInstallSheet();
				return;
			}
			if (event.key !== "Tab" || !panel) return;
			const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
			const first = items[0];
			const last = items[items.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		}

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			root.style.overflow = overflow;
			opener?.focus();
		};
	}, [open]);

	if (!open) return null;

	async function install(): Promise<void> {
		play("tap");
		if ((await startInstall("sheet")) === "accepted") closeInstallSheet();
	}

	function copyLink(): void {
		play("notification");
		navigator.clipboard
			.writeText(window.location.href)
			.then(() => showToast(t("pwa.linkCopied")))
			.catch(() => {});
	}

	let body: ReactNode;
	if (canPrompt) {
		body = (
			<button
				type="button"
				data-autofocus
				onClick={install}
				className="w-full rounded-xl bg-accent-bg px-4 py-3.5 text-base font-semibold text-accent-text"
			>
				{t("pwa.installApp")}
			</button>
		);
	} else if (platform === "ios") {
		body = (
			<ol className="divide-y divide-border border-y border-border">
				<Step number={1} icon={<Share size={20} />}>
					{t("pwa.iosShare")}
				</Step>
				<Step number={2} icon={<SquarePlus size={20} />}>
					{t("pwa.iosAdd")}
				</Step>
				<Step number={3} icon={<Check size={20} />}>
					{t("pwa.iosConfirm")}
				</Step>
			</ol>
		);
	} else if (platform === "in-app") {
		body = (
			<div className="space-y-4">
				<p className="text-sm leading-relaxed text-primary">{t("pwa.inApp")}</p>
				<button
					type="button"
					data-autofocus
					onClick={copyLink}
					className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-bg px-4 py-3.5 text-base font-semibold text-accent-text"
				>
					<Copy size={18} />
					{t("pwa.copyLink")}
				</button>
			</div>
		);
	} else {
		body = (
			<p className="text-sm leading-relaxed text-primary">
				{t(STEPS_TEXT[platform] ?? "pwa.desktop")}
			</p>
		);
	}

	return (
		<div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
			<button
				type="button"
				tabIndex={-1}
				aria-label={t("pwa.close")}
				onClick={close}
				className={cn(
					"absolute inset-0 cursor-default bg-black/50 animate-in fade-in duration-200 transition-opacity",
					leaving && "opacity-0",
				)}
			/>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				style={{
					transform: leaving ? "translateY(100%)" : `translateY(${Math.max(0, swipe.offset.y)}px)`,
				}}
				className={cn(
					"relative max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border bg-background px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300 sm:max-w-md sm:rounded-3xl sm:border sm:py-6 sm:zoom-in-95 sm:slide-in-from-bottom-4",
					!swipe.dragging && "transition-transform duration-200",
				)}
			>
				<div {...swipe.handlers} className="touch-none pt-3 sm:pt-0">
					<div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border-subtle sm:hidden" />
					<div className="flex items-start gap-4">
						<img
							src="/apple-touch-icon.png"
							alt=""
							width={56}
							height={56}
							className="size-14 shrink-0 rounded-[22%] shadow-md"
						/>
						<div className="min-w-0 flex-1">
							<h2 id={titleId} className="text-lg font-bold text-primary">
								{t("pwa.installTitle")}
							</h2>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
								{t("pwa.installLead")}
							</p>
						</div>
						<button
							type="button"
							onClick={close}
							aria-label={t("pwa.close")}
							className="-me-2 -mt-1 shrink-0 rounded-full p-2 text-muted-foreground hover:bg-surface-hover hover:text-primary"
						>
							<X size={20} />
						</button>
					</div>
				</div>
				<div className="mt-6">{body}</div>
			</div>
		</div>
	);
}
