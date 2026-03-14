import { useState } from "react";
import {
  HelpCircle, BookOpen, CheckCircle2, AlertTriangle, Mail, ChevronDown, ChevronUp,
} from "lucide-react";

type FAQItem = { q: string; a: string | string[] };

function FAQSection({ title, icon: Icon, color, items }: {
  title: string;
  icon: React.ElementType;
  color: string;
  items: FAQItem[];
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mb-10">
      <div className={`flex items-center gap-3 mb-5 pb-3 border-b-2 ${color}`}>
        <Icon className="h-6 w-6" />
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900 pr-4 break-words">{item.q}</span>
              {open === i
                ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
            </button>
            {open === i && (
              <div className="px-5 pb-5 bg-gray-50 border-t border-gray-100">
                {Array.isArray(item.a) ? (
                  <ol className="mt-3 space-y-2 list-none">
                    {item.a.map((step, si) => (
                      <li key={si} className="flex gap-3 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium mt-0.5">{si + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">{item.a}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Content ─────────────────────────────────────────────────────────────────

const assessmentGuide: FAQItem[] = [
  {
    q: "I received an invitation email — what do I do first?",
    a: [
      "Open the email and click the Set Password & Sign In button.",
      "You will be taken to a page where you enter your name and choose a password.",
      "Fill in your details and click Activate Account.",
      "You will be redirected to the login page. Sign in with your email and the password you just set.",
      "You are now ready to take the assessment from your dashboard.",
    ],
  },
  {
    q: "My invite link says it has expired or is invalid.",
    a: "The invitation link is valid for 1 hour and can only be used once. If it has expired, or you accidentally closed the browser before finishing, contact your administrator and ask them to resend the invite. A fresh link will be sent to your email.",
  },
  {
    q: "How do I start the assessment?",
    a: [
      "Log in at the platform with your email and password.",
      "On your Dashboard, find the cohort you have been enrolled in.",
      "Click Begin Assessment next to the cohort name.",
      "Read the section introduction, then click Begin Section to start answering questions.",
    ],
  },
  {
    q: "How do I answer the ranking questions?",
    a: [
      "Each question presents 4 options. You rank them in order of preference — 1st for the option most like you, through to 4th for the least.",
      "Click the option you want to rank 1st. It will be highlighted with a '1' badge.",
      "Then click your 2nd choice, 3rd choice — the 4th option is assigned automatically.",
      "The question advances automatically once all 4 options are ranked.",
      "On the last question, all 4 options are ranked and a Complete Assessment button appears — click it when you are ready to submit.",
    ],
  },
  {
    q: "Can I go back and change a ranking within a question?",
    a: "Yes. Click any already-ranked option to clear it and all rankings below it, then re-rank from that point. For example, clicking your 2nd choice will clear ranks 2, 3, and 4 so you can re-order them.",
  },
  {
    q: "Can I go back to a previous question?",
    a: "Yes — use the Back button at the bottom of the question. If you leave a question without completing all 4 rankings, that question's partial answer is cleared so it starts fresh when you return.",
  },
  {
    q: "How many questions are there and how long does it take?",
    a: "There are 36 questions split across 3 sections of 12 each — Is (how you currently work), Should (what your role demands), and Want (your natural preference). Most people finish in 10–15 minutes. Take your time; your first instinct is usually the most accurate.",
  },
  {
    q: "What is the PAEI framework?",
    a: "PAEI stands for Producer, Administrator, Entrepreneur, and Integrator — four management styles identified by the Adizes Institute. The assessment measures how strongly each style shows up across three dimensions: how you currently behave (Is), what your role requires (Should), and what you naturally prefer (Want). The results help you understand your strengths, blind spots, and areas for growth as a leader.",
  },
  {
    q: "How do I view my results?",
    a: [
      "Your results open automatically after you submit the assessment.",
      "You can also return to them any time from your Dashboard — click View Results next to your completed cohort.",
      "The results include your PAEI profile, a radar chart comparing Is / Should / Want, a gap analysis, and a personalised style interpretation.",
    ],
  },
  {
    q: "How do I download my PDF report?",
    a: [
      "Go to your results page.",
      "Look for the Download Full Report (PDF) button at the bottom of the page.",
      "If it shows 'Generating report…', wait a few seconds and click Check again — the report is being prepared in the background.",
      "Once ready, click the button to open the full PDF in a new tab. You can save or print it from there.",
    ],
  },
  {
    q: "Can I retake the assessment?",
    a: "Each assessment is designed to capture a snapshot of your style at a specific point in time. You cannot retake the assessment on your own — if you need a reset (for example, after a significant role change), please contact your administrator or email team@turiyaskills.co.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your results are visible only to you and the administrators of your cohort. Your data is stored securely and is never shared outside your organisation.",
  },
];

const dosDonts: FAQItem[] = [
  {
    q: "✅  Things to do for the best results",
    a: [
      "Answer honestly — there are no right or wrong answers. The PAEI model reflects real-world management styles, not ideal ones.",
      "Go with your first instinct. Overthinking tends to produce a less accurate picture of your natural style.",
      "Read each question carefully before ranking. Some questions ask about your current behaviour; others ask about what your role requires or what you prefer.",
      "Complete the assessment in a single sitting in a quiet environment, free of interruptions.",
      "Rank all 4 options even if you feel two options are equally good — the forced ranking is intentional.",
      "Download and read your PDF report after completing the assessment for the full, detailed interpretation.",
    ],
  },
  {
    q: "❌  Things to avoid",
    a: [
      "Do not try to game the results or answer what you think the 'ideal' leader should say — the value of PAEI comes from honest self-reflection.",
      "Do not share your login credentials with anyone. Your account and results are personal.",
      "Do not close the browser mid-assessment without submitting. Your answers are stored as you go, but closing the browser means your session may not be resumed cleanly.",
      "Do not answer on behalf of someone else — the assessment is designed for self-report only.",
      "Do not compare raw scores directly with colleagues without context — the gap analysis and interpretation are more meaningful than scores in isolation.",
    ],
  },
];

const contactCards = [
  {
    icon: "🏢",
    label: "Programme & Cohort Queries",
    description: "Questions about your cohort, invitation, or programme logistics",
    email: "support@hileadership.com",
  },
  {
    icon: "⚙️",
    label: "Technical Support",
    description: "Login issues, broken links, assessment errors, or anything not working",
    email: "team@turiyaskills.co",
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export function UserHelp() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto pb-16">

      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900">Help & FAQs</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Everything you need to know about taking the Adizes PAEI Management Style Assessment.
        </p>
      </div>

      {/* Section 1 — Assessment guide */}
      <FAQSection
        title="User Guide — Taking the Assessment"
        icon={BookOpen}
        color="border-primary"
        items={assessmentGuide}
      />

      {/* Section 2 — Dos & Don'ts */}
      <FAQSection
        title="Do's and Don'ts"
        icon={CheckCircle2}
        color="border-teal-500"
        items={dosDonts}
      />

      {/* Section 3 — Contact */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-5 pb-3 border-b-2 border-[#1D3557]">
          <Mail className="h-6 w-6 text-[#1D3557]" />
          <h2 className="text-lg font-semibold text-gray-900">Contact & Support</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contactCards.map((c, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-5 bg-white">
              <div className="text-2xl mb-3">{c.icon}</div>
              <p className="font-semibold text-gray-900 text-sm mb-1">{c.label}</p>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{c.description}</p>
              <a
                href={`mailto:${c.email}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                {c.email}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Response time: typically within 1 business day. For urgent issues, mention "URGENT" in your subject line.
        </p>
      </div>

      {/* Footer note */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-6 py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-medium text-gray-700">About this platform — </span>
            The Adizes PAEI Management Style Indicator (AMSI) is developed by the Adizes Institute.
            This platform is operated by HILeadership in partnership with Turiyaskills.
            For programme questions contact{" "}
            <a href="mailto:support@hileadership.com" className="text-primary hover:underline">support@hileadership.com</a>.
            For technical issues contact{" "}
            <a href="mailto:team@turiyaskills.co" className="text-primary hover:underline">team@turiyaskills.co</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
