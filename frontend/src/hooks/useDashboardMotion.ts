"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import type { OpsStatus } from "@/components/heist/StatusIndicator";

type UseDashboardMotionArgs = {
  rootRef: RefObject<HTMLElement | null>;
  status: OpsStatus;
};

const STABLE_ACCENT = "rgba(101,230,173,0.22)";
const PANEL_BORDER = "rgba(219,234,226,0.14)";

function queryAll<T extends Element>(
  root: ParentNode,
  selector: string
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function useDashboardMotion({
  rootRef,
  status,
}: UseDashboardMotionArgs): void {
  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const context = gsap.context(() => {
      const heroElements = queryAll<HTMLElement>(root, '[data-motion="hero"]');
      const leftPanels = queryAll<HTMLElement>(
        root,
        '[data-motion="left-panel"]'
      );
      const terminalPanel = queryAll<HTMLElement>(
        root,
        '[data-motion="terminal"]'
      );
      const archivePanel = queryAll<HTMLElement>(
        root,
        '[data-motion="archive"]'
      );

      const introTargets = [
        ...heroElements,
        ...leftPanels,
        ...terminalPanel,
        ...archivePanel,
      ];

      gsap.set(introTargets, {
        opacity: 0,
        y: 22,
      });

      gsap.set(terminalPanel, {
        x: 24,
        y: 0,
      });

      const timeline = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

      timeline
        .to(heroElements, {
          opacity: 1,
          y: 0,
          duration: 0.72,
          stagger: 0.08,
          clearProps: "opacity,transform",
        })
        .to(
          leftPanels,
          {
            opacity: 1,
            y: 0,
            duration: 0.66,
            stagger: 0.1,
            clearProps: "opacity,transform",
          },
          "-=0.34"
        )
        .to(
          terminalPanel,
          {
            opacity: 1,
            x: 0,
            duration: 0.72,
            clearProps: "opacity,transform",
          },
          "-=0.46"
        )
        .to(
          archivePanel,
          {
            opacity: 1,
            y: 0,
            duration: 0.66,
            clearProps: "opacity,transform",
          },
          "-=0.4"
        );
    }, root);

    return () => {
      context.revert();
    };
  }, [rootRef]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const reactivePanels = queryAll<HTMLElement>(
      root,
      '[data-ops-reactive="true"]'
    );
    const heroTitle = root.querySelector<HTMLElement>(
      '[data-hero-title="true"]'
    );

    const timeline = gsap.timeline({
      defaults: {
        ease: "power2.out",
      },
    });

    if (reactivePanels.length > 0) {
      timeline
        .fromTo(
          reactivePanels,
          {
            y: 0,
            borderColor: PANEL_BORDER,
          },
          {
            y: -2,
            borderColor: STABLE_ACCENT,
            duration: 0.22,
            stagger: 0.04,
          }
        )
        .to(reactivePanels, {
          y: 0,
          borderColor: PANEL_BORDER,
          duration: 0.24,
          stagger: 0.04,
        });
    }

    if (heroTitle) {
      timeline.fromTo(
        heroTitle,
        {
          scale: 1,
          y: 0,
        },
        {
          scale: status === "IDLE" ? 1 : 1.006,
          y: status === "IDLE" ? 0 : -1,
          duration: 0.28,
          yoyo: true,
          repeat: 1,
        },
        0
      );
    }

    return () => {
      timeline.kill();
    };
  }, [rootRef, status]);
}
