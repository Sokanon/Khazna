import { useSyncExternalStore } from "react";
import { getPwaState, type PwaState, subscribe } from "../lib/pwa";

export function usePwa(): PwaState {
	return useSyncExternalStore(subscribe, getPwaState);
}
