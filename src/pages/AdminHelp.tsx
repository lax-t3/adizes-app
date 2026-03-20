import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, Users, ShieldCheck, BookOpen, FileText, Mail, KeyRound } from "lucide-react";

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
              <span className="text-sm font-medium text-gray-900 pr-4 overflow-hidden break-words">{item.q}</span>
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

const adminFAQs: FAQItem[] = [
  {
    q: "How do I invite another administrator to the platform?",
    a: [
      "Go to Administrators in the left sidebar.",
      "Click Invite Administrator and enter their name and email address.",
      "Click Send Invite — they will receive an email with a link to set their password.",
      "Once they set their password, they can log in at adizes-app.turiyaskills.co and access the full admin panel.",
    ],
  },
  {
    q: "The invited admin says their link is not working. What should I do?",
    a: [
      "Go to Administrators in the left sidebar.",
      "Find the admin whose status shows as Invited.",
      "Click Resend Invite — this generates a brand new link and sends it to them.",
      "Ask them to click the new link and complete registration in the same browser session without closing the tab.",
    ],
  },
  {
    q: "How do I create a cohort?",
    a: [
      "Go to Cohorts in the left sidebar.",
      "Click New Cohort and give it a name (e.g. 'Leadership Team – Q1 2026') and an optional description.",
      "Click Create. The cohort is now ready to accept members.",
    ],
  },
  {
    q: "How do I enrol users into a cohort?",
    a: [
      "Open the cohort from the Cohorts page.",
      "Click Enrol Member and enter the user's email address.",
      "If the user already has an account, they are added immediately.",
      "If the user does not have an account yet, they will automatically receive an invitation email to set up their account and join the cohort.",
      "You can also upload a CSV/bulk list using the Bulk Enrol option to add multiple users at once.",
    ],
  },
  {
    q: "A user says they never received their invitation email. What do I do?",
    a: [
      "Open the cohort and find the user in the member list.",
      "If their status shows Pending, click the Resend Invite button next to their name.",
      "Ask the user to check their spam/junk folder as well.",
      "The invite link is valid for 1 hour from the time it is sent. If the user does not act within that time, resend it again.",
    ],
  },
  {
    q: "How do I view the assessment results for users in a cohort?",
    a: [
      "Go to Cohorts and open the relevant cohort.",
      "You will see a list of all members with their assessment status (Pending or Completed).",
      "Click on any completed member's name to view their full PAEI results, scores, gap analysis, and interpretation.",
    ],
  },
  {
    q: "How do I download a user's PDF report?",
    a: [
      "Open the cohort and click on the user whose report you want.",
      "On the respondent details page, look for the Download PDF button.",
      "If the button shows 'Generating…', wait a moment and click Check Again — the PDF is being prepared in the background.",
      "Once ready, clicking the button will open the full report as a PDF in a new tab, which you can save or print.",
    ],
  },
  {
    q: "Can I remove a user from a cohort?",
    a: "Yes. Open the cohort, find the user in the member list, and click the remove (trash) icon next to their name. This removes them from the cohort only — their account and any completed assessments are not deleted.",
  },
  {
    q: "What is a cohort and why does it matter?",
    a: "A cohort is a group of people who take the PAEI assessment together — for example, a leadership team, a department, or a training batch. Grouping users into cohorts lets you track completion progress, compare team PAEI profiles, and export results as a group. Each user can belong to one or more cohorts.",
  },
  {
    q: "Can a user take the assessment more than once?",
    a: "Each user can take the assessment once per session. If they need to retake it (for example, after a significant role change), contact technical support at team@turiyaskills.co to reset their assessment.",
  },
];

const dosDonts: FAQItem[] = [
  {
    q: "What should I always do when inviting users?",
    a: [
      "Always double-check the email address before sending an invite — typos cannot be corrected after the invite is sent.",
      "Tell the user to complete the registration in one go without closing the browser tab — the invite link works only once.",
      "Use Resend Invite if a user reports not receiving the email or if the link expired.",
      "Create a separate cohort for each distinct group or programme to keep results organised.",
    ],
  },
  {
    q: "What should I avoid doing?",
    a: [
      "Do not share another person's invite link with someone else — each link is tied to a specific email address.",
      "Do not delete an admin account that is your own — the system will not allow it.",
      "Do not enrol the same user in the same cohort twice — the system will flag it as a duplicate.",
      "Do not share your admin login credentials with others — invite them as administrators instead.",
    ],
  },
];

const userFAQs: FAQItem[] = [
  {
    q: "I received an invitation email. What do I do next?",
    a: [
      "Click the Set Password & Sign In button in the email.",
      "You will be taken to a page to enter your name and choose a password.",
      "Fill in your details and click Activate Account.",
      "You will be redirected to the login page — sign in with your email and the password you just set.",
    ],
  },
  {
    q: "My invite link says it has expired or is invalid. What should I do?",
    a: "The invitation link can only be used once and is valid for 1 hour after it is sent. If it has expired or you accidentally closed the browser before completing registration, contact your administrator and ask them to resend the invite. A new link will be sent to your email.",
  },
  {
    q: "How do I take the assessment?",
    a: [
      "Log in at adizes-app.turiyaskills.co with your email and password.",
      "From your dashboard, click Start Assessment.",
      "You will answer 36 questions across three sections — Is (how you currently work), Should (what your role requires), and Want (what you naturally prefer).",
      "For each question, select the one option that best describes you. There are no right or wrong answers.",
      "Once you have answered all 36 questions, click Submit to see your results.",
    ],
  },
  {
    q: "How long does the assessment take?",
    a: "Most people complete the assessment in 10 to 15 minutes. Take your time and answer honestly — your first instinct is usually the best answer.",
  },
  {
    q: "What is PAEI?",
    a: "PAEI stands for Producer, Administrator, Entrepreneur, and Integrator — four management styles identified by the Adizes Institute. The assessment measures how strongly each style shows up in your current role, what your role demands, and what you naturally prefer. The results help you understand your strengths, blind spots, and areas for development as a leader.",
  },
  {
    q: "How do I view my results?",
    a: [
      "After submitting the assessment, your results page opens automatically.",
      "You can also access your results any time by logging in and going to My Dashboard.",
      "Your dashboard shows your PAEI profile, scores for each dimension, and a gap analysis between your Is, Should, and Want profiles.",
    ],
  },
  {
    q: "How do I download my PDF report?",
    a: [
      "Go to your results page.",
      "Look for the Download PDF button at the bottom of the page.",
      "If it shows 'Generating your PDF…', wait a few seconds and click Check Again.",
      "Once the report is ready, clicking the button will open a full PDF report in a new tab that you can save or print.",
    ],
  },
  {
    q: "Can I change my answers after submitting?",
    a: "No — once you submit the assessment your answers are final. The PAEI model is designed to capture your instinctive responses, so revisiting and changing answers would affect the reliability of your results. If you believe you made a significant error, contact your administrator.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your individual assessment results are visible only to you and the administrators of your cohort. Your data is stored securely and is not shared with anyone outside your organisation.",
  },
];

const employeeActivationFAQs: FAQItem[] = [
  {
    q: "How does employee account activation work?",
    a: [
      "When you add an employee to an organisation, they receive a welcome email with an activation link valid for 24 hours.",
      "They click the link, set their name and password, and their account becomes active.",
      "If they miss the 24-hour window, go to the employee's node in the Organisations page and click 'Resend Welcome Email' to generate a fresh link.",
    ],
  },
  {
    q: "What if an employee never activated their account?",
    a: "Their status shows as 'Pending' in the employee list. They cannot use self-service password reset until they have activated. Ask them to check their original welcome email, or resend it from the admin panel. Once activated, they can reset their password independently at any time.",
  },
  {
    q: "How does self-service password reset work for employees?",
    a: [
      "Activated employees can reset their own password by clicking 'Forgot password?' on the login page.",
      "They enter their email address. If their account is activated, a reset link is sent to their inbox (valid for 1 hour).",
      "If their account is still in 'Pending' status, the page will tell them to activate their account first using their welcome email.",
      "Admins do not need to be involved in this process.",
    ],
  },
  {
    q: "What fields can I set when adding or editing an employee?",
    a: "First name, last name, middle name, email, job title, employee ID, employment status (Active / Inactive / On Leave / Probation / Resigned), gender, default language, manager email, date of birth (DD/MM/YYYY), employment start date, and head-of-department flag. Email and first name cannot be changed after the account is created — they are the login identity.",
  },
];

const contactInfo = [
  {
    label: "Cohort & Programme Queries",
    description: "Questions about cohort setup, assessment groups, or programme logistics",
    email: "support@hileadership.com",
    icon: "🏢",
  },
  {
    label: "Technical Support",
    description: "Login issues, broken links, app errors, or anything not working as expected",
    email: "team@turiyaskills.co",
    icon: "⚙️",
  },
];

export function AdminHelp() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900">Help & FAQs</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Answers to common questions for administrators and users of the Adizes PAEI platform.
        </p>
      </div>

      <FAQSection
        title="Administrator Guide — Managing Cohorts & Users"
        icon={ShieldCheck}
        color="border-primary"
        items={adminFAQs}
      />

      <FAQSection
        title="Do's and Don'ts for Administrators"
        icon={BookOpen}
        color="border-amber-500"
        items={dosDonts}
      />

      <FAQSection
        title="Employee Activation & Password Reset"
        icon={KeyRound}
        color="border-[#1D3557]"
        items={employeeActivationFAQs}
      />

      <FAQSection
        title="User Guide — Taking the Assessment"
        icon={Users}
        color="border-teal-500"
        items={userFAQs}
      />

      {/* Contact section */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-5 pb-3 border-b-2 border-navy">
          <Mail className="h-6 w-6 text-[#1D3557]" />
          <h2 className="text-lg font-semibold text-gray-900">Contact & Support</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contactInfo.map((c, i) => (
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
          Response time: typically within 1 business day. For urgent issues, please mention "URGENT" in your subject line.
        </p>
      </div>

      {/* Footer note */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-6 py-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-700">About this platform —</span> The Adizes PAEI Management Style Indicator (AMSI) is developed by the Adizes Institute. This platform is operated by HILeadership in partnership with Turiyaskills. For programme-related questions contact <a href="mailto:support@hileadership.com" className="text-primary hover:underline">support@hileadership.com</a>. For technical issues contact <a href="mailto:team@turiyaskills.co" className="text-primary hover:underline">team@turiyaskills.co</a>.
        </p>
      </div>
    </div>
  );
}
