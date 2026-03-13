import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessmentStore } from "@/store/assessmentStore";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Card, CardContent } from "@/components/ui/Card";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { getQuestions, submitAssessment } from "@/api/assessment";

export function Assessment() {
  const navigate = useNavigate();
  const {
    sections,
    setSections,
    currentSection,
    currentQuestion,
    answers,
    saveAnswer,
    nextQuestion,
    prevQuestion,
    nextSection,
    setResultId,
    reset,
  } = useAssessmentStore();

  const [showIntro, setShowIntro] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load questions on mount if not already loaded
  useEffect(() => {
    if (sections.length === 0) {
      setLoadingQuestions(true);
      getQuestions()
        .then((data) => setSections(data.sections))
        .catch(() => setError("Failed to load questions. Please refresh the page."))
        .finally(() => setLoadingQuestions(false));
    }
  }, []);

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 text-center">
            <p className="text-red-600 font-medium mb-4">{error}</p>
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
  const currentAnswer = answers[question.question_index];
  const isLastSection = currentSection === sections.length - 1;
  const isLastQuestion = currentQuestion === totalPerSection - 1;

  const handleOptionSelect = (optionKey: string) => {
    saveAnswer(question.question_index, optionKey);
  };

  const handleNext = async () => {
    if (!isLastQuestion) {
      nextQuestion();
    } else if (!isLastSection) {
      nextSection();
      setShowIntro(true);
    } else {
      // Submit all answers
      setSubmitting(true);
      try {
        const answerPayload = Object.entries(answers).map(([idx, key]) => ({
          question_index: Number(idx),
          option_key: key,
        }));
        const result = await submitAssessment(answerPayload);
        setResultId(result.result_id);
        navigate(`/results?id=${result.result_id}`);
      } catch {
        setError("Failed to submit assessment. Please try again.");
        setSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      prevQuestion();
    } else if (currentSection > 0) {
      // Go back to previous section's last question
      useAssessmentStore.setState((state) => ({
        currentSection: (state.currentSection - 1) as 0 | 1 | 2,
        currentQuestion: sections[currentSection - 1].questions.length - 1,
      }));
    }
  };

  const isAtStart = currentSection === 0 && currentQuestion === 0;

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
              <p className="text-sm text-gray-400 mb-8 sm:mb-12">{totalPerSection} questions</p>
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
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-medium text-gray-900 mb-6 sm:mb-10 text-center leading-tight">
                {question.text}
              </h2>

              <div className="space-y-4">
                {question.options.map((option) => {
                  const isSelected = currentAnswer === option.key;
                  return (
                    <button
                      key={option.key}
                      onClick={() => handleOptionSelect(option.key)}
                      className={cn(
                        "w-full text-left p-4 sm:p-6 rounded-xl border-2 transition-all duration-200 flex items-center justify-between group",
                        isSelected
                          ? "border-primary bg-primary text-white shadow-md scale-[1.02]"
                          : "border-gray-200 bg-white hover:border-primary-light hover:bg-primary-light/30 text-gray-700"
                      )}
                    >
                      <span className={cn("text-lg font-medium", isSelected ? "text-white" : "text-gray-900")}>
                        {option.text}
                      </span>
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors flex-shrink-0 ml-4",
                          isSelected
                            ? "border-white bg-white text-primary"
                            : "border-gray-300 group-hover:border-primary-light"
                        )}
                      >
                        {isSelected && <CheckCircle2 className="h-4 w-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer Controls */}
          <div className="mt-8 sm:mt-12 flex flex-wrap items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={isAtStart}
              className="text-gray-500"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={!currentAnswer}
              size="lg"
              className={cn(
                "px-8 transition-all",
                currentAnswer ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
              )}
            >
              {isLastQuestion && isLastSection ? "Complete Assessment" : "Next Question"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
