import { z } from "zod";

import { Steps } from "../../../data-display/steps";
import { defineOpenUIComponent } from "../../types";

export const Progress = defineOpenUIComponent({
  name: "Progress",
  props: z.object({
    steps: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
      })
    ),
    currentStep: z.number(),
  }),
  description:
    "A progress indicator showing completed, current, and upcoming steps. Use for multi-step wizards and onboarding flows.",
  component: ({ props }) => {
    const steps = props.steps ?? [];
    const currentStep = props.currentStep ?? 0;

    if (steps.length === 0) {
      return null;
    }

    return (
      <Steps
        steps={steps}
        currentStep={currentStep}
        orientation="horizontal"
        ariaLabel="Progress steps"
      />
    );
  },
});
