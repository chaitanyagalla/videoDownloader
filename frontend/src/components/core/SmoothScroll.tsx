"use client";

import { useEffect } from "react";

function hasScrollableParent(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  let node: HTMLElement | null = target;

  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight;

    if (canScroll) {
      return true;
    }

    node = node.parentElement;
  }

  return false;
}

export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let currentY = window.scrollY;
    let targetY = window.scrollY;
    let frameId = 0;

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const animate = () => {
      currentY += (targetY - currentY) * 0.1;

      if (Math.abs(targetY - currentY) < 0.2) {
        currentY = targetY;
      }

      window.scrollTo(0, currentY);

      if (Math.abs(targetY - currentY) >= 0.2) {
        frameId = window.requestAnimationFrame(animate);
      } else {
        frameId = 0;
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        hasScrollableParent(event.target)
      ) {
        return;
      }

      event.preventDefault();
      targetY = Math.min(maxScroll(), Math.max(0, targetY + event.deltaY));

      if (!frameId) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    const syncScrollPosition = () => {
      if (!frameId) {
        currentY = window.scrollY;
        targetY = window.scrollY;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", syncScrollPosition, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", syncScrollPosition);

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return null;
}
