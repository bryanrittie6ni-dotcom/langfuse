import { type PropsWithChildren } from "react";
import { useMediaQuery } from "react-responsive";
import dynamic from "next/dynamic";

const DynamicMobileRightDrawer = dynamic(
  () =>
    import("./MobileRightDrawer").then((mod) => ({
      default: mod.MobileRightDrawer,
    })),
  {
    ssr: false,
  },
);

/**
 * App-shell content wrapper.
 *
 * Desktop renders children directly (support drawer removed).
 * Mobile uses a bottom drawer.
 */
export function AppContentWithRightDrawer({ children }: PropsWithChildren) {
  const isDesktop = useMediaQuery({ query: "(min-width: 768px)" });

  if (!isDesktop) {
    return <DynamicMobileRightDrawer>{children}</DynamicMobileRightDrawer>;
  }

  // Support drawer removed for self-hosted deployment
  return <>{children}</>;
}
