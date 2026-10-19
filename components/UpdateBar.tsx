import { RefreshCw, X } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePwa } from "../hooks/usePwa";
import { useSound } from "../hooks/useSound";
import { applyUpdate } from "../lib/pwa";
import { cn } from "../lib/utils";

/** Offers a new version found mid-use. It never reloads on its own while someone is busy. */
export function UpdateBar(): JSX.Element | null {
	const { updateReady } = usePwa();
	const { t } = useTranslation();
	const play = useSound();
	const [hidden, setHidden] = useState(false);
	const [applying, setApplying] = useState(false);

	if (!updateReady || hidden) return null;

	return (
		<div
			role="status"
			className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[45] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 ps-4 shadow-2xl shadow-black/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-6 duration-300"
		>
			<RefreshCw
				size={18}
				className={cn("shrink-0 text-muted-foreground", applying && "animate-spin")}
			/>
			<p className="min-w-0 flex-1 text-sm font-medium text-primary">{t("pwa.updateReady")}</p>
			<button
				type="button"
				disabled={applying}
				onClick={() => {
					play("tap");
					setApplying(true);
					applyUpdate();
				}}
				className="shrink-0 rounded-full bg-accent-bg px-4 py-2 text-sm font-semibold text-accent-text disabled:opacity-60"
			>
				{t("pwa.update")}
			</button>
			<button
				type="button"
				onClick={() => setHidden(true)}
				aria-label={t("pwa.close")}
				className="-me-1 shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-primary"
			>
				<X size={18} />
			</button>
		</div>
	);
}
