import React from "react";
import {
  SplashScreen,
  type ValueProposition,
} from "@/src/components/ui/splash-screen";
import { Bot, Gauge, Zap, BarChart4, Code2 } from "lucide-react";
import { useIsCodeEvalEnabled } from "@/src/features/evals/hooks/useIsCodeEvalEnabled";
import { EvalTemplateSourceCodeLanguage } from "@langfuse/shared";

interface EvaluatorsOnboardingProps {
  projectId: string;
}

export function EvaluatorsOnboarding(_props: EvaluatorsOnboardingProps) {
  return null;
}
