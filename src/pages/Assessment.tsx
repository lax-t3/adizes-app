import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAssessmentStore } from "@/store/assessmentStore";
import type { RankMap } from "@/store/assessmentStore";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Card, CardContent } from "@/components/ui/Card";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { getQuestions, submitAssessment } from "@/api/assessment";

const ORDINALS = ["1st", "2nd", "3rd", "4th"];

// Opacity levels for rank badges: rank 1 = full, rank 4 = lightest
const RANK_BADGE_STYLES: Record<number, string> = {
  1: "bg-primary text-white",
  2: "bg-primary/75 text-white",
  3: "bg-primary/45 text-white",
  4: "bg-primary/25 text-primary",
};
const RANK_CARD_STYLES: Record<number, string> = {
  1: "border-primary bg-primary/10",
  2: "border-primary/60 bg-primary/6",
  3: "border-primary/35 bg-primary/3",
  4: "border-primary/20 bg-gray-50",
};

function isRankMapComplete(rankMap: RankMap): boolean {
  return Object.values(rankMap).every((v) => v !== null);
}

function initRankMap(optionKeys: string[]): RankMap {
  return Object.fromEntries(optionKeys.map((k) => [k, null]));
}

export function Assessment() {
  const navigate = useNavigate();
  const {
    sections,
    setSections,
    currentSection,
    currentQuestion,
    answers,
    saveRanks,
    nextQuestion,
    prevQuestion,
    nextSection,
    setResultId,
    cohortId,
    setCohortId,
  } = useAssessmentStore();

  const [searchParams] = useSearchParams();

  const [showVideoIntro, setShowVideoIntro] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");   // full-page error (load failure)
  const [submitError, setSubmitError] = useState(""); // inline error (submit failure)
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const paramCohortId = searchParams.get("cohort_id");
    if (!paramCohortId) {
      navigate("/dashboard");
      return;
    }
    setCohortId(paramCohortId);
  }, []);

  useEffect(() => {
    if (sections.length === 0) {
      setLoadingQuestions(true);
      getQuestions()
        .then((data) => setSections(data.sections))
        .catch(() => setLoadError("Failed to load questions. Please refresh the page."))
        .finally(() => setLoadingQuestions(false));
    }
  }, []);

  // Clear any pending auto-advance when question changes
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [currentSection, currentQuestion]);

  if (loadingQuestions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading assessment…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 text-center">
            <p className="text-red-600 font-medium mb-4">{loadError}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sections.length === 0) return null;

  const section = sections[currentSection];
  const question = section.questions[currentQuestion];
  const totalPerSection = section.questions.length;
  const totalQuestions = sections.reduce((acc, s) => acc + s.questions.length, 0);
  const answeredSoFar = currentSection * totalPerSection + currentQuestion;
  const progress = (answeredSoFar / totalQuestions) * 100;
  const isLastSection = currentSection === sections.length - 1;
  const isLastQuestion = currentQuestion === totalPerSection - 1;

  const optionKeys = question.options.map((o) => o.key);
  const currentRankMap: RankMap =
    answers[question.question_index] ?? initRankMap(optionKeys);
  const rankedCount = Object.values(currentRankMap).filter((v) => v !== null).length;
  const isComplete = rankedCount === 4;
  const nextRankOrdinal = ORDINALS[rankedCount] ?? "";

  const handleOptionClick = (optionKey: string) => {
    const currentRank = currentRankMap[optionKey];

    if (currentRank !== null) {
      // Clear this rank and all ranks greater than it
      const newMap: RankMap = { ...currentRankMap };
      for (const [k, v] of Object.entries(newMap)) {
        if (v !== null && v >= currentRank) newMap[k] = null;
      }
      saveRanks(question.question_index, newMap);
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    } else {
      const nextRank = rankedCount + 1;
      const newMap: RankMap = { ...currentRankMap, [optionKey]: nextRank };

      // Auto-assign rank 4 to the last unranked option when 3 are done
      if (nextRank === 3) {
        const lastUnranked = optionKeys.find((k) => newMap[k] === null && k !== optionKey);
        if (lastUnranked) newMap[lastUnranked] = 4;
      }

      saveRanks(question.question_index, newMap);

      // Auto-advance on completion — but NOT on the last question of the last section.
      // There the user must click "Complete Assessment" deliberately.
      const willBeComplete = nextRank === 3 || nextRank === 4;
      const isLastQ = isLastQuestion && isLastSection;
      if (willBeComplete && !isLastQ) {
        autoAdvanceTimer.current = setTimeout(() => handleNext(newMap), 400);
      }
    }
  };

  const handleNext = (completedMap?: RankMap) => {
    const map = completedMap ?? currentRankMap;
    if (!isRankMapComplete(map)) return;

    if (!isLastQuestion) {
      nextQuestion();
    } else if (!isLastSection) {
      nextSection();
      setShowIntro(true);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!cohortId) {
      navigate("/dashboard");
      return;
    }

    setSubmitError("");

    // Validate every question has all 4 ranks filled in
    const allQuestions = sections.flatMap((s) => s.questions);
    const incompleteNums = allQuestions
      .filter((q) => {
        const rm = answers[q.question_index];
        return !rm || !isRankMapComplete(rm);
      })
      .map((q) => q.question_index + 1); // 1-based for display

    if (incompleteNums.length > 0) {
      setSubmitError(
        `Question${incompleteNums.length > 1 ? "s" : ""} ${incompleteNums.join(", ")} ${incompleteNums.length > 1 ? "are" : "is"} incomplete — please go back and rank all 4 options.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const answerPayload = Object.entries(answers).map(([idx, rankMap]) => ({
        question_index: Number(idx),
        ranks: Object.fromEntries(
          Object.entries(rankMap).filter(([, v]) => v !== null)
        ) as Record<string, number>,
      }));
      const result = await submitAssessment(cohortId, answerPayload);
      setResultId(result.result_id);
      useAssessmentStore.getState().reset();
      navigate(`/results?id=${result.result_id}`);
    } catch {
      setSubmitError("Failed to submit assessment. Please try again.");
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    // If leaving an incomplete question, clear its partial answer so it starts
    // fresh when the user returns — prevents stale partial ranks blocking submit.
    if (!isComplete) {
      saveRanks(question.question_index, initRankMap(optionKeys));
    }
    if (currentQuestion > 0) {
      prevQuestion();
    } else if (currentSection > 0) {
      useAssessmentStore.setState((state) => ({
        currentSection: (state.currentSection - 1) as 0 | 1 | 2,
        currentQuestion: sections[state.currentSection - 1].questions.length - 1,
      }));
    }
  };

  const isAtStart = currentSection === 0 && currentQuestion === 0;

  // Pre-assessment video intro screen
  if (showVideoIntro) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl"
        >
          <Card className="border-t-4 border-t-primary shadow-lg">
            <CardContent className="p-6 sm:p-10">
              <div className="text-center mb-6">
                <h2 className="font-display text-3xl font-bold text-gray-900 mb-2">
                  Before You Begin
                </h2>
                <p className="text-gray-500 text-base max-w-xl mx-auto">
                  Watch this short video to understand the Adizes PAEI framework and get the most out of your assessment.
                </p>
              </div>

              {/* 16:9 YouTube embed */}
              <div className="relative w-full mb-8" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full rounded-lg shadow"
                  src="https://www.youtube.com/embed/qhtbLtR2zBE"
                  title="Adizes PAEI Framework Introduction"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-gray-400">
                  Take your time — click the button when you're ready to start.
                </p>
                <Button
                  size="lg"
                  onClick={() => setShowVideoIntro(false)}
                  className="w-full sm:w-auto px-10 text-lg h-14 shrink-0"
                >
                  I'm Ready — Begin Assessment <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Section intro screen
  if (showIntro) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-t-4 border-t-primary shadow-lg">
            <CardContent className="p-6 sm:p-12 text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
                <span className="font-display text-2xl font-bold">{currentSection + 1}</span>
              </div>
              <h2 className="font-display text-4xl font-bold text-gray-900 mb-4">
                Section {currentSection + 1} of 3: {section.label}
              </h2>
              <p className="text-xl text-gray-600 mb-4">{section.description}</p>
              <p className="text-sm text-gray-400 mb-4">{totalPerSection} questions</p>
              <p className="text-sm text-gray-500 mb-8 sm:mb-12 max-w-md mx-auto">
                For each question, click the options in order of preference — <strong>1st</strong> for most like you,
                through to <strong>4th</strong> for least like you.
              </p>
              <Button size="lg" onClick={() => setShowIntro(false)} className="w-full sm:w-auto px-12 text-lg h-14">
                Begin Section <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Calculating your results…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-gray-900">AMSI</span>
              <span className="text-gray-400">|</span>
              <span className="text-sm font-medium text-gray-600">{section.label}</span>
            </div>
            <div className="text-sm font-medium text-gray-500">
              {answeredSoFar + 1} of {totalQuestions}
            </div>
          </div>
          <ProgressBar value={progress} className="h-1.5" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentSection}-${currentQuestion}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-medium text-gray-900 mb-4 text-center leading-tight">
                {question.text}
              </h2>

              {/* Rank prompt */}
              <p className="text-center text-sm font-medium text-gray-500 mb-6">
                {isComplete ? (
                  <span className="text-primary">All ranked — advancing…</span>
                ) : (
                  <>Select your <strong className="text-gray-800">{nextRankOrdinal}</strong> choice — {4 - rankedCount} remaining</>
                )}
              </p>

              <div className="space-y-3">
                {question.options.map((option) => {
                  const rank = currentRankMap[option.key];
                  const isRanked = rank !== null;
                  return (
                    <button
                      key={option.key}
                      onClick={() => handleOptionClick(option.key)}
                      className={cn(
                        "w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4",
                        isRanked
                          ? RANK_CARD_STYLES[rank as number]
                          : "border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/5 text-gray-700"
                      )}
                    >
                      {/* Rank badge */}
                      <div
                        className={cn(
                          "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm transition-all",
                          isRanked
                            ? RANK_BADGE_STYLES[rank as number]
                            : "border-2 border-gray-300 text-gray-400"
                        )}
                      >
                        {isRanked ? rank : ""}
                      </div>
                      <span className={cn(
                        "text-base font-medium flex-1",
                        isRanked ? "text-gray-800" : "text-gray-700"
                      )}>
                        {option.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer Controls */}
          <div className="mt-8 sm:mt-12 space-y-4">
            {submitError && (
              <p className="text-sm text-red-600 text-center font-medium">{submitError}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={isAtStart}
                className="text-gray-500"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>

              {/* On last question: always show submit button (no auto-advance).
                  On other questions: show Next only when complete (fallback if auto-advance stalls). */}
              {isLastQuestion && isLastSection ? (
                <Button
                  onClick={() => handleNext()}
                  size="lg"
                  className="px-8"
                  disabled={!isComplete}
                >
                  Complete Assessment
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                isComplete && (
                  <Button
                    onClick={() => handleNext()}
                    size="lg"
                    className="px-8"
                  >
                    Next Question
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
