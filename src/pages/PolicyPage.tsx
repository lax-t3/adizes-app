import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

// ─── Policy content ───────────────────────────────────────────────────────────

const POLICIES: Record<string, { title: string; lastUpdated: string; sections: { heading: string; body: string }[] }> = {
  terms: {
    title: "Terms of Service",
    lastUpdated: "March 2026",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        body: "By registering for or using the Adizes PAEI Management Style Indicator (AMSI) platform ('Platform'), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.",
      },
      {
        heading: "2. Use of the Platform",
        body: "The Platform is provided for professional development and organisational assessment purposes. You agree to use the Platform only for lawful purposes and in accordance with these Terms. You must not misuse, copy, distribute, or reverse-engineer any part of the Platform.",
      },
      {
        heading: "3. Account Registration",
        body: "You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorised use of your account. We reserve the right to suspend or terminate accounts that violate these Terms.",
      },
      {
        heading: "4. Assessment Data",
        body: "Your assessment responses and results are stored securely. Results may be shared with the administrator of the cohort you belong to for the purpose of team development analysis. Please refer to our Privacy Policy for full details on how your data is handled.",
      },
      {
        heading: "5. Intellectual Property",
        body: "The PAEI framework, assessment content, report templates, and all associated materials are the intellectual property of the Adizes Institute. Reproduction or redistribution without prior written consent is prohibited.",
      },
      {
        heading: "6. Limitation of Liability",
        body: "The Platform and assessment results are provided for informational and developmental purposes only. The Adizes Institute and Turiyaskills shall not be liable for any decisions made based on assessment results. Results do not constitute professional psychological or career advice.",
      },
      {
        heading: "7. Modifications",
        body: "We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the revised Terms.",
      },
      {
        heading: "8. Governing Law",
        body: "These Terms are governed by and construed in accordance with applicable law. Any disputes shall be subject to the exclusive jurisdiction of the competent courts.",
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    lastUpdated: "March 2026",
    sections: [
      {
        heading: "1. Information We Collect",
        body: "We collect information you provide directly when registering (name, email address) and information generated through your use of the Platform (assessment responses, scores, and generated reports). We do not collect payment information directly — all payments are handled by our payment processors.",
      },
      {
        heading: "2. How We Use Your Information",
        body: "Your data is used to: deliver your assessment and personalised PAEI report; allow your cohort administrator to view aggregated team results; improve the Platform's functionality; send you account-related communications (including assessment notifications and results).",
      },
      {
        heading: "3. Data Sharing",
        body: "We do not sell your personal data. Assessment results may be visible to the administrator of the cohort to which you belong. We may share data with third-party service providers (cloud hosting, email delivery) strictly to operate the Platform, under appropriate data processing agreements.",
      },
      {
        heading: "4. Data Retention",
        body: "We retain your account and assessment data for as long as your account is active or as needed to provide services. You may request deletion of your data by contacting us. Some data may be retained for a limited period to comply with legal obligations.",
      },
      {
        heading: "5. Security",
        body: "We implement industry-standard security measures including encrypted data transmission (TLS), secure authentication, and access controls. Assessment data is stored in a SOC 2 compliant cloud environment.",
      },
      {
        heading: "6. Your Rights",
        body: "You have the right to access, correct, or request deletion of your personal data. You may also request a copy of your data in a portable format. To exercise these rights, contact us at the details below.",
      },
      {
        heading: "7. Cookies",
        body: "The Platform uses only essential cookies required for authentication and session management. We do not use advertising or tracking cookies.",
      },
      {
        heading: "8. Contact",
        body: "For privacy-related enquiries, please contact us through the platform administrator or via the Adizes Institute website.",
      },
    ],
  },

  refund: {
    title: "Refund Policy",
    lastUpdated: "March 2026",
    sections: [
      {
        heading: "1. Assessment Access",
        body: "Access to the AMSI assessment platform is typically provisioned by your organisation or a designated administrator. Individual purchases, where available, may be subject to the refund terms below.",
      },
      {
        heading: "2. Eligibility for Refunds",
        body: "Refund requests must be submitted within 7 days of purchase and before the assessment has been completed. Once an assessment has been started or completed, no refund will be issued as the service has been rendered.",
      },
      {
        heading: "3. How to Request a Refund",
        body: "To request a refund, contact your administrator or reach out to the Adizes Institute via official channels with your order details and reason for the request. Approved refunds will be processed within 10 business days.",
      },
      {
        heading: "4. Non-Refundable Items",
        body: "The following are non-refundable: completed assessments; bulk cohort licences that have been partially used; PDF report downloads that have been generated and delivered.",
      },
      {
        heading: "5. Organisational Purchases",
        body: "For organisational or bulk purchases, refund terms are governed by the specific contract or agreement between your organisation and the Adizes Institute / Turiyaskills. Please refer to your purchase agreement for details.",
      },
      {
        heading: "6. Changes to This Policy",
        body: "We reserve the right to update this Refund Policy. Any changes will be communicated via the Platform and will apply to future purchases only.",
      },
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

type PolicySlug = "terms" | "privacy" | "refund";

interface PolicyPageProps {
  slug?: PolicySlug;
}

export function PolicyPage({ slug: propSlug }: PolicyPageProps) {
  const { slug: paramSlug } = useParams<{ slug: PolicySlug }>();
  const slug = (propSlug ?? paramSlug) as PolicySlug;
  const policy = POLICIES[slug];

  if (!policy) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
            <Link to="/" className="text-primary hover:underline text-sm">Back to home</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Simple top bar */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.png" alt="Adizes Institute" className="h-10 w-auto" />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 sm:p-12">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Legal</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{policy.title}</h1>
          <p className="text-sm text-gray-400 mb-10">Last updated: {policy.lastUpdated}</p>

          <div className="space-y-8">
            {policy.sections.map((section) => (
              <div key={section.heading}>
                <h2 className="text-base font-semibold text-gray-900 mb-2">{section.heading}</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>

          {/* Cross-links */}
          <div className="mt-12 pt-8 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3">Related policies</p>
            <div className="flex flex-wrap gap-3">
              {(["terms", "privacy", "refund"] as PolicySlug[])
                .filter(s => s !== slug)
                .map(s => (
                  <Link
                    key={s}
                    to={`/${s}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {POLICIES[s].title}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
