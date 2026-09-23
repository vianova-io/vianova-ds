"use client";

import {
  Questionnaire,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireItem,
  QuestionnaireProgress,
  QuestionnaireTitle,
} from "@/registry/vianova/ui/questionnaire";

export default function QuestionnaireDefault() {
  return (
    <Questionnaire className="w-full max-w-sm">
      <QuestionnaireProgress />
      <QuestionnaireItem name="focus">
        <QuestionnaireTitle>What are you analysing?</QuestionnaireTitle>
        <QuestionnaireDescription>
          This tunes the default layers and metrics.
        </QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="od">Origin-destination flows</QuestionnaireChoice>
          <QuestionnaireChoice value="curb">Curb and parking use</QuestionnaireChoice>
          <QuestionnaireChoice value="safety">Road safety</QuestionnaireChoice>
        </QuestionnaireChoices>
      </QuestionnaireItem>
    </Questionnaire>
  );
}
