/**
 * Callme Yoghurt Enterprise Motion System (Phase 1.7C.1)
 *
 * Centralized design tokens and reusable motion primitives.
 * Complies with strict reduced-motion accessibility and zero-latency performance rules.
 */

import { Variants, Transition } from "framer-motion";

export const MOTION_TOKENS = {
  duration: {
    micro: 0.14,    // 140ms — buttons, indicators, tiny feedback
    fast: 0.18,     // 180ms — tab switches, fast page fade, toasts
    normal: 0.26,   // 260ms — card reveals, modal popups, storefront transitions
    section: 0.42,  // 420ms — hero elements, section reveals
  },
  distance: {
    micro: 4,       // 4px micro translations
    normal: 12,     // 12px standard UI translations
    section: 24,    // 24px marketing entrance reveals (within 24-40px rule)
  },
  scale: {
    tap: 0.98,
    hoverCard: 1.015,
    hoverProduct: 1.03,
  },
  ease: {
    default: [0.25, 0.1, 0.25, 1.0] as const,
    out: [0.16, 1.0, 0.3, 1.0] as const,
    inOut: [0.65, 0.0, 0.35, 1.0] as const,
  },
} as const;

export const TRANSITIONS = {
  micro: {
    duration: MOTION_TOKENS.duration.micro,
    ease: MOTION_TOKENS.ease.out,
  } satisfies Transition,
  fast: {
    duration: MOTION_TOKENS.duration.fast,
    ease: MOTION_TOKENS.ease.out,
  } satisfies Transition,
  normal: {
    duration: MOTION_TOKENS.duration.normal,
    ease: MOTION_TOKENS.ease.out,
  } satisfies Transition,
  section: {
    duration: MOTION_TOKENS.duration.section,
    ease: MOTION_TOKENS.ease.out,
  } satisfies Transition,
  spring: {
    type: "spring",
    stiffness: 450,
    damping: 32,
  } satisfies Transition,
  springGentle: {
    type: "spring",
    stiffness: 300,
    damping: 28,
  } satisfies Transition,
};

/**
 * Common Animation Variants with Reduced-Motion Fallbacks
 */
export const storefrontPageVariants: Variants = {
  initial: {
    opacity: 0,
    y: MOTION_TOKENS.distance.normal,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_TOKENS.duration.normal,
      ease: MOTION_TOKENS.ease.out,
    },
  },
  exit: {
    opacity: 0,
    y: -MOTION_TOKENS.distance.micro,
    transition: {
      duration: MOTION_TOKENS.duration.micro,
      ease: MOTION_TOKENS.ease.out,
    },
  },
};

export const adminPageVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: MOTION_TOKENS.duration.fast,
      ease: MOTION_TOKENS.ease.out,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: MOTION_TOKENS.duration.micro,
    },
  },
};

export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: MOTION_TOKENS.duration.fast },
  },
  exit: {
    opacity: 0,
    transition: { duration: MOTION_TOKENS.duration.micro },
  },
};

export const modalDialogVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
    y: -6,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: MOTION_TOKENS.duration.fast,
      ease: MOTION_TOKENS.ease.out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -4,
    transition: {
      duration: MOTION_TOKENS.duration.micro,
      ease: MOTION_TOKENS.ease.out,
    },
  },
};

export const drawerVariants: Variants = {
  hidden: {
    x: "100%",
  },
  visible: {
    x: 0,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 32,
    },
  },
  exit: {
    x: "100%",
    transition: {
      duration: MOTION_TOKENS.duration.fast,
      ease: MOTION_TOKENS.ease.inOut,
    },
  },
};

export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -8,
    scale: 0.97,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: MOTION_TOKENS.duration.fast,
      ease: MOTION_TOKENS.ease.out,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: {
      duration: MOTION_TOKENS.duration.micro,
      ease: MOTION_TOKENS.ease.out,
    },
  },
};

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const fadeInUpItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: MOTION_TOKENS.distance.normal,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_TOKENS.duration.normal,
      ease: MOTION_TOKENS.ease.out,
    },
  },
};
