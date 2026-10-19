import { useSyncExternalStore } from "react";
import { getOfflineScreens, type OfflineScreens, subscribeOfflineScreens } from "../lib/offline";

export function useOfflineScreens(): OfflineScreens {
	return useSyncExternalStore(subscribeOfflineScreens, getOfflineScreens);
}
