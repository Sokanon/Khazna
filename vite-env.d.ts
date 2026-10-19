/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />

declare module "*.md" {
	export const html: string;
}
