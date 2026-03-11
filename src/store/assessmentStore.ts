import { create } from 'zustand';
import type { Section } from '@/types/api';

interface AssessmentState {
  // Questions loaded from API
  sections: Section[];
  setSections: (sections: Section[]) => void;

  // Navigation
  currentSection: 0 | 1 | 2;
  currentQuestion: number;

  // Answers: key = question_index (0-based), value = option_key ('a'|'b'|'c'|'d')
  answers: Record<number, string>;
  saveAnswer: (questionIndex: number, optionKey: string) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  nextSection: () => void;

  // Result after submission
  resultId: string | null;
  setResultId: (id: string) => void;

  reset: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  sections: [],
  setSections: (sections) => set({ sections }),

  currentSection: 0,
  currentQuestion: 0,
  answers: {},

  saveAnswer: (questionIndex, optionKey) =>
    set((state) => ({
      answers: { ...state.answers, [questionIndex]: optionKey },
    })),

  nextQuestion: () =>
    set((state) => ({ currentQuestion: state.currentQuestion + 1 })),

  prevQuestion: () =>
    set((state) => ({ currentQuestion: Math.max(0, state.currentQuestion - 1) })),

  nextSection: () =>
    set((state) => ({
      currentSection: Math.min(2, state.currentSection + 1) as 0 | 1 | 2,
      currentQuestion: 0,
    })),

  resultId: null,
  setResultId: (id) => set({ resultId: id }),

  reset: () => set({
    sections: [],
    currentSection: 0,
    currentQuestion: 0,
    answers: {},
    resultId: null,
  }),
}));
