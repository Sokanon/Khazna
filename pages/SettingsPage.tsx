import type { LucideIcon } from "lucide-react";
import {
	ArrowUpRight,
	Check,
	ChevronRight,
	Figma,
	Github,
	Info,
	Languages,
	Loader2,
	Mail,
	Moon,
	RefreshCw,
	Share2,
	Volume2,
} from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { SOCIAL_LINKS } from "../constants";
import { useContribute } from "../hooks/useContribute";
import { useLanguage } from "../hooks/useLanguage";
import { usePwa } from "../hooks/usePwa";
import { useSound } from "../hooks/useSound";
import { useUIContext } from "../hooks/useUIContext";
import { applyUpdate, checkForUpdate } from "../lib/pwa";
import { showToast } from "../lib/toast";
import { cn } from "../lib/utils";

const ROW = "flex w-full min-h-14 items-center gap-3 px-4 py-2.5 text-start text-primary";

function Group({ title, children }: { title: string; children: ReactNode }): JSX.Element {
	return (
		<section className="space-y-2">
			<h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				{title}
			</h2>
			<div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
				{children}
			</div>
		</section>
	);
}

function RowIcon({ icon: Icon }: { icon: LucideIcon }): JSX.Element {
	return (
		<span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
			<Icon size={17} />
		</span>
	);
}

function Switch({ on }: { on: boolean }): JSX.Element {
	return (
		<span
			data-switch
			className={cn(
				"relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
				on ? "bg-primary" : "bg-border-subtle",
			)}
		>
			<span
				className={cn(
					"absolute top-0.5 start-0.5 size-6 rounded-full bg-background shadow transition-transform duration-200",
					on && "translate-x-5 rtl:-translate-x-5",
				)}
			/>
		</span>
	);
}

type UpdateStatus = "idle" | "checking" | "current" | "unavailable";

/** The installed app's settings, in place of the website's header buttons and menu. */
export function SettingsPage(): JSX.Element {
	const { standalone, updateReady } = usePwa();
	const { theme, toggleTheme, soundEnabled, toggleSound } = useUIContext();
	const { currentLanguage, toggleLanguage } = useLanguage();
	const contribute = useContribute();
	const { t } = useTranslation();
	const play = useSound();
	const themeSwitch = useRef<HTMLButtonElement>(null);
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");

	if (!standalone) return <Navigate to="/" replace />;

	function switchTheme(): void {
		play("toggle-theme");
		// The new theme spreads out from the switch itself.
		toggleTheme(themeSwitch.current?.querySelector("[data-switch]")?.getBoundingClientRect());
	}

	function switchSound(): void {
		// useSound is silent while sounds are off, so the "on" sound plays directly.
		if (!soundEnabled) new Audio("/sounds/toggle_on.wav").play().catch(() => {});
		toggleSound();
	}

	function pickLanguage(code: string): void {
		if (code === currentLanguage) return;
		play("slider");
		toggleLanguage();
	}

	async function shareApp(): Promise<void> {
		play("tap");
		const url = window.location.origin;
		if (typeof navigator.share === "function") {
			await navigator.share({ title: "Khazna", url }).catch(() => {});
			return;
		}
		await navigator.clipboard
			.writeText(url)
			.then(() => showToast(t("pwa.linkCopied")))
			.catch(() => {});
	}

	async function updates(): Promise<void> {
		play("tap");
		if (updateReady) {
			applyUpdate();
			return;
		}
		setUpdateStatus("checking");
		const result = await checkForUpdate();
		setUpdateStatus(result === "ready" ? "idle" : result);
	}

	let updateLabel: ReactNode;
	if (updateReady) {
		updateLabel = (
			<span className="rounded-full bg-accent-bg px-3 py-1 text-xs font-semibold text-accent-text">
				{t("pwa.update")}
			</span>
		);
	} else if (updateStatus === "checking") {
		updateLabel = (
			<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
				<Loader2 size={14} className="animate-spin" />
				{t("settings.checking")}
			</span>
		);
	} else if (updateStatus === "current") {
		updateLabel = (
			<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
				<Check size={14} />
				{t("settings.upToDate")}
			</span>
		);
	} else {
		updateLabel = (
			<span className="text-sm text-muted-foreground">
				{updateStatus === "unavailable" ? t("settings.tryLater") : t("settings.check")}
			</span>
		);
	}

	return (
		<div className="mx-auto max-w-xl space-y-7 pt-8 pb-10">
			<div className="flex items-center gap-4">
				<img
					src="/apple-touch-icon.png"
					alt=""
					width={64}
					height={64}
					className="size-16 rounded-[22%] shadow-md"
				/>
				<div>
					<h1 className="text-2xl font-bold text-primary">{t("tabs.settings")}</h1>
					<p className="text-sm text-muted-foreground">{t("settings.tagline")}</p>
				</div>
			</div>

			<Group title={t("settings.preferences")}>
				<button
					ref={themeSwitch}
					type="button"
					role="switch"
					aria-checked={theme === "dark"}
					onClick={switchTheme}
					className={ROW}
				>
					<RowIcon icon={Moon} />
					<span className="flex-1 font-medium">{t("settings.darkMode")}</span>
					<Switch on={theme === "dark"} />
				</button>
				<div className={ROW}>
					<RowIcon icon={Languages} />
					<span className="flex-1 font-medium">{t("settings.language")}</span>
					<div className="flex rounded-lg border border-border bg-background p-0.5">
						{[
							{ code: "ar", label: "العربية" },
							{ code: "en", label: "English" },
						].map((option) => (
							<button
								key={option.code}
								type="button"
								lang={option.code}
								aria-pressed={currentLanguage === option.code}
								onClick={() => pickLanguage(option.code)}
								className={cn(
									"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
									currentLanguage === option.code
										? "bg-surface-hover text-primary shadow-sm"
										: "text-muted-foreground",
								)}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={soundEnabled}
					onClick={switchSound}
					className={ROW}
				>
					<RowIcon icon={Volume2} />
					<span className="flex-1 font-medium">{t("settings.sounds")}</span>
					<Switch on={soundEnabled} />
				</button>
			</Group>

			<Group title={t("settings.khazna")}>
				<Link to="/about" onClick={() => play("tap")} className={ROW}>
					<RowIcon icon={Info} />
					<span className="flex-1 font-medium">{t("navbar.about")}</span>
					<ChevronRight size={18} className="text-muted-foreground rtl:rotate-180" />
				</Link>
				<button type="button" onClick={contribute} className={ROW}>
					<RowIcon icon={Mail} />
					<span className="flex-1 font-medium">{t("navbar.contribute")}</span>
					<ChevronRight size={18} className="text-muted-foreground rtl:rotate-180" />
				</button>
				<a href={SOCIAL_LINKS.github} target="_blank" rel="noreferrer" className={ROW}>
					<RowIcon icon={Github} />
					<span className="flex-1 font-medium">GitHub</span>
					<ArrowUpRight size={18} className="text-muted-foreground rtl:-scale-x-100" />
				</a>
				<a href={SOCIAL_LINKS.figma} target="_blank" rel="noreferrer" className={ROW}>
					<RowIcon icon={Figma} />
					<span className="flex-1 font-medium">{t("settings.figma")}</span>
					<ArrowUpRight size={18} className="text-muted-foreground rtl:-scale-x-100" />
				</a>
				<button type="button" onClick={shareApp} className={ROW}>
					<RowIcon icon={Share2} />
					<span className="flex-1 font-medium">{t("settings.share")}</span>
				</button>
			</Group>

			<Group title={t("settings.app")}>
				<button
					type="button"
					onClick={updates}
					disabled={updateStatus === "checking"}
					className={ROW}
				>
					<RowIcon icon={RefreshCw} />
					<span className="flex-1 font-medium">{t("settings.updates")}</span>
					{updateLabel}
				</button>
			</Group>
		</div>
	);
}
