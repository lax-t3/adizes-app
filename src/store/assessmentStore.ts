import { create } from 'zustand';
import type { Section } from '@/types/api';

// RankMap: one entry per option key, null = not yet ranked
export type RankMap = Record<string, number | null>;  // { a: 1|2|3|4|null, ... }

interface AssessmentState {
  // Questions loaded from API
  sections: Section[];
  setSections: (sections: Section[]) => void;

  // Navigation
  currentSection: 0 | 1 | 2;
  currentQuestion: number;

  // Answers: key = question_index (0-based), value = rank map for that question
  answers: Record<number, RankMap>;
  saveRanks: (questionIndex: number, rankMap: RankMap) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  nextSection: () => void;

  // Cohort context for this assessment session
  cohortId: string | null;
  setCohortId: (id: string) => void;

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

  saveRanks: (questionIndex, rankMap) =>
    set((state) => ({
      answers: { ...state.answers, [questionIndex]: rankMap },
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

  cohortId: null,
  setCohortId: (id) => set({ cohortId: id }),

  resultId: null,
  setResultId: (id) => set({ resultId: id }),

  reset: () => set({
    sections: [],
    currentSection: 0,
    currentQuestion: 0,
    answers: {},
    cohortId: null,
    resultId: null,
  }),
}));
