import type { MouseEvent, PointerEvent } from "react";
import { useRef, useState } from "react";

export type SwipeDirection = "left" | "right" | "up" | "down";

type Axis = "x" | "y" | "both";

type Gesture = { id: number; x: number; y: number; time: number; axis: "x" | "y" | null };

// Movement before a touch counts as a drag, and the flick speed (px/ms) that swipes on its own.
const SLOP = 8;
const FLICK_SPEED = 0.5;
const FLICK_MIN = 24;

/**
 * Follows one finger along an axis and reports a swipe when it lifts. Mouse drags are left
 * alone, a second finger (a pinch) cancels, and the tap that ends a swipe never clicks.
 * Give the element a touch-action that leaves the tracked axis to it.
 */
export function useSwipe({
	axis,
	onSwipe,
	distance = 80,
}: {
	axis: Axis;
	onSwipe: (direction: SwipeDirection) => void;
	distance?: number;
}) {
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const gesture = useRef<Gesture | null>(null);
	const swiped = useRef(false);

	function reset(): void {
		gesture.current = null;
		setOffset({ x: 0, y: 0 });
	}

	const handlers = {
		onPointerDown(e: PointerEvent<HTMLElement>): void {
			swiped.current = false;
			if (e.pointerType === "mouse") return;
			if (gesture.current) {
				reset();
				return;
			}
			gesture.current = {
				id: e.pointerId,
				x: e.clientX,
				y: e.clientY,
				time: e.timeStamp,
				axis: null,
			};
		},
		onPointerMove(e: PointerEvent<HTMLElement>): void {
			const g = gesture.current;
			if (!g || e.pointerId !== g.id) return;
			const dx = e.clientX - g.x;
			const dy = e.clientY - g.y;
			if (!g.axis) {
				if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
				const along = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
				if (axis !== "both" && along !== axis) {
					gesture.current = null;
					return;
				}
				g.axis = along;
				e.currentTarget.setPointerCapture(e.pointerId);
			}
			setOffset(g.axis === "x" ? { x: dx, y: 0 } : { x: 0, y: dy });
		},
		onPointerUp(e: PointerEvent<HTMLElement>): void {
			const g = gesture.current;
			reset();
			if (!g?.axis || e.pointerId !== g.id) return;
			const delta = g.axis === "x" ? e.clientX - g.x : e.clientY - g.y;
			const speed = Math.abs(delta) / Math.max(1, e.timeStamp - g.time);
			if (Math.abs(delta) < distance && (Math.abs(delta) < FLICK_MIN || speed < FLICK_SPEED))
				return;
			swiped.current = true;
			if (g.axis === "x") onSwipe(delta < 0 ? "left" : "right");
			else onSwipe(delta < 0 ? "up" : "down");
		},
		onPointerCancel: reset,
		onClickCapture(e: MouseEvent<HTMLElement>): void {
			if (!swiped.current) return;
			swiped.current = false;
			e.preventDefault();
			e.stopPropagation();
		},
	};

	return { offset, dragging: offset.x !== 0 || offset.y !== 0, handlers };
}
