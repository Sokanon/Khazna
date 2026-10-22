import { CloudOff, ImageOff } from "lucide-react";
import type { CSSProperties, ImgHTMLAttributes, JSX, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOnline } from "../hooks/useOnline";
import { cn } from "../lib/utils";

type FallbackImageProps = ImgHTMLAttributes<HTMLImageElement> & {
	src: string;
	alt: string;
	/** Shown instead of the browser's broken image, for instance offline before it was saved. */
	fallback: ReactNode;
	/** Added until the image has loaded, so a slow connection shows something is on its way. */
	loadingClassName?: string;
};

/** An image that gives way to a designed fallback when it can't load, and tries again once back online. */
export function FallbackImage({
	src,
	alt,
	fallback,
	loadingClassName,
	className,
	onLoad,
	onError,
	...props
}: FallbackImageProps): JSX.Element {
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const failed = failedSrc === src;

	useEffect(() => {
		if (!failed) return;
		const retry = (): void => {
			setFailedSrc(null);
			setAttempt((n) => n + 1);
		};
		window.addEventListener("online", retry);
		return () => window.removeEventListener("online", retry);
	}, [failed]);

	if (failed) return <>{fallback}</>;
	return (
		<img
			key={attempt}
			src={src}
			alt={alt}
			className={cn(className, loadedSrc !== src && loadingClassName)}
			onLoad={(event) => {
				setLoadedSrc(src);
				onLoad?.(event);
			}}
			onError={(event) => {
				setFailedSrc(src);
				onError?.(event);
			}}
			{...props}
		/>
	);
}

/** Stands in for an app screenshot that isn't on the device yet. */
export function ScreenPlaceholder({
	label,
	className,
	style,
}: {
	label: string;
	className?: string;
	style?: CSSProperties;
}): JSX.Element {
	const { t } = useTranslation();
	const online = useOnline();
	const Icon = online ? ImageOff : CloudOff;
	return (
		<div
			role="img"
			aria-label={label}
			style={style}
			className={cn(
				"flex size-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-subtle",
				className,
			)}
		>
			<span className="flex size-11 items-center justify-center rounded-full bg-current/10">
				<Icon size={20} strokeWidth={1.75} />
			</span>
			<span className="max-w-40 text-xs leading-relaxed text-balance">
				{online ? t("pwa.screenFailed") : t("pwa.screenLater")}
			</span>
		</div>
	);
}
