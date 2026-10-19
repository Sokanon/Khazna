import type { LucideIcon } from "lucide-react";
import { LayoutGrid, Settings, Smartphone } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { usePwa } from "../hooks/usePwa";
import { useSound } from "../hooks/useSound";
import { cn } from "../lib/utils";

type Tab = {
	id: string;
	root: string;
	icon: LucideIcon;
	labelKey: string;
	owns: (pathname: string) => boolean;
};

const TABS: Tab[] = [
	{ id: "logos", root: "/", icon: LayoutGrid, labelKey: "navbar.logos", owns: (p) => p === "/" },
	{
		id: "apps",
		root: "/apps",
		icon: Smartphone,
		labelKey: "tabs.apps",
		owns: (p) => p.startsWith("/apps"),
	},
	{
		id: "settings",
		root: "/settings",
		icon: Settings,
		labelKey: "tabs.settings",
		owns: (p) => ["/settings", "/about", "/contributing"].includes(p),
	},
];

/**
 * The installed app's navigation on phones, in place of the website's menu. Like a native tab
 * bar, each tab comes back to the page and scroll position it was left on, and tapping the
 * current tab goes back to its first page, then to the top.
 */
export function TabBar(): JSX.Element | null {
	const { standalone } = usePwa();
	const { t } = useTranslation();
	const play = useSound();
	const navigate = useNavigate();
	const location = useLocation();
	const memory = useRef<Record<string, { path: string; scroll: number }>>({});
	const restoreTo = useRef<number | null>(null);
	const current = TABS.find((tab) => tab.owns(location.pathname));

	// Runs after ScrollToTop (an earlier sibling), so a restored position wins over the reset.
	// biome-ignore lint/correctness/useExhaustiveDependencies: restores on every page change
	useEffect(() => {
		if (restoreTo.current === null) return;
		const top = restoreTo.current;
		restoreTo.current = null;
		requestAnimationFrame(() => window.scrollTo(0, top));
	}, [location.key]);

	if (!standalone) return null;

	function open(tab: Tab): void {
		play("tap");
		if (current?.id === tab.id) {
			if (location.pathname !== tab.root) navigate(tab.root);
			else window.scrollTo({ top: 0, behavior: "smooth" });
			return;
		}
		if (current) {
			memory.current[current.id] = {
				path: location.pathname + location.search + location.hash,
				scroll: window.scrollY,
			};
		}
		const saved = memory.current[tab.id];
		restoreTo.current = saved?.scroll ?? 0;
		navigate(saved?.path ?? tab.root);
	}

	return (
		<nav
			aria-label={t("tabs.label")}
			className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 backdrop-blur-xl md:hidden"
			style={{
				paddingBottom: "env(safe-area-inset-bottom)",
				paddingLeft: "env(safe-area-inset-left)",
				paddingRight: "env(safe-area-inset-right)",
			}}
		>
			<div className="flex h-14 items-stretch">
				{TABS.map((tab) => {
					const active = current?.id === tab.id;
					const Icon = tab.icon;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => open(tab)}
							aria-current={active ? "page" : undefined}
							className="flex flex-1 flex-col items-center justify-center gap-1"
						>
							<span
								className={cn(
									"flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200",
									active ? "bg-surface-hover text-primary" : "text-muted-foreground",
								)}
							>
								<Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
							</span>
							<span
								className={cn(
									"text-[11px] leading-none",
									active ? "font-semibold text-primary" : "font-medium text-muted-foreground",
								)}
							>
								{t(tab.labelKey)}
							</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
}
