import { create } from "zustand";
import { getCoachingLeadsPendingCount } from "@/api/coaching";

interface CoachingLeadsState {
  pending: number;
  setPending: (n: number) => void;
  /** Refetch the pending (not-yet-actioned) lead count from the API. */
  refresh: () => Promise<void>;
}

export const useCoachingLeadsStore = create<CoachingLeadsState>((set) => ({
  pending: 0,
  setPending: (n) => set({ pending: n }),
  refresh: async () => {
    try {
      set({ pending: await getCoachingLeadsPendingCount() });
    } catch {
      // non-fatal — leave the last known count
    }
  },
}));
