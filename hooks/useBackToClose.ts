import { useCallback, useEffect, useRef } from "react";

/**
 * While an overlay is open, the back button (Android's, or the browser's) closes it instead of
 * leaving the page, the way a sheet or a viewer closes in a native app.
 *
 * Returns `dismiss`, for closing from the overlay's own UI: it takes the extra history entry
 * back off first and then runs `after`, so a navigation started from inside the overlay
 * replaces nothing and lands where it should.
 */
export function useBackToClose(open: boolean, onClose: () => void): (after?: () => void) => void {
	const hasEntry = useRef(false);
	const afterClose = useRef<(() => void) | undefined>(undefined);
	const close = useRef(onClose);
	close.current = onClose;

	useEffect(() => {
		if (!open) return;
		// The router's own state rides along, so its idea of where we are doesn't change.
		window.history.pushState({ ...window.history.state, overlay: true }, "");
		hasEntry.current = true;

		function onPopState(): void {
			if (!hasEntry.current) return;
			hasEntry.current = false;
			close.current();
			const after = afterClose.current;
			afterClose.current = undefined;
			after?.();
		}

		window.addEventListener("popstate", onPopState);
		return () => {
			window.removeEventListener("popstate", onPopState);
			// Closed some other way: take the entry back off so Back doesn't land on nothing.
			if (hasEntry.current) {
				hasEntry.current = false;
				window.history.back();
			}
		};
	}, [open]);

	return useCallback((after?: () => void) => {
		if (hasEntry.current) {
			afterClose.current = after;
			window.history.back();
			return;
		}
		close.current();
		after?.();
	}, []);
}
