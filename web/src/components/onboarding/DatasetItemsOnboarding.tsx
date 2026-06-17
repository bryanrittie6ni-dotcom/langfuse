import { useState } from "react";
import { SplashScreen } from "@/src/components/ui/splash-screen";
import { Braces, Code, ListTree, Upload } from "lucide-react";
import DocPopup from "@/src/components/layouts/doc-popup";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { CsvUploadDialog } from "@/src/features/datasets/components/CsvUploadDialog";
import { NewDatasetItemForm } from "@/src/features/datasets/components/NewDatasetItemForm";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import { cn } from "@/src/utils/tailwind";

interface DatasetItemEntryPointRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  hasAccess?: boolean;
  comingSoon?: boolean;
  docPopup?: {
    description: string;
    href: string;
  };
}

const DatasetItemEntryPointRow = ({
  icon,
  title,
  description,
  onClick,
  hasAccess = true,
  comingSoon = false,
  docPopup,
}: DatasetItemEntryPointRowProps) => {
  const disabled = !hasAccess || comingSoon;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      className={cn(
        "border-border flex h-20 items-center gap-4 rounded-lg border p-4 transition-colors",
        disabled
          ? "bg-muted text-muted-foreground opacity-60"
          : "bg-card hover:bg-accent/50 cursor-pointer",
      )}
      onClick={!disabled ? onClick : undefined}
      onKeyDown={
        !disabled
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      title={
        !hasAccess
          ? "You don't have access to this feature, please contact your administrator"
          : undefined
      }
    >
      <div className="flex items-center">{icon}</div>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-1">
          <p className="text-muted-foreground text-sm">{description}</p>
          {docPopup && (
            <DocPopup description={docPopup.description} href={docPopup.href} />
          )}
        </div>
      </div>
    </div>
  );
};

export const DatasetItemsOnboarding = (_props: {
  projectId: string;
  datasetId: string;
}) => {
  return null;
};
