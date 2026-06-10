import { ArrowRight, Zap, Target, Compass, TrendingUp, BarChart3, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SAMPLE_PDF_URL =
  "https://swiznkamzxyfzgckebqi.supabase.co/storage/v1/object/public/samples/AMSI%20for%20Jack%20Allen.pdf";

function HeroSection() {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden text-white py-24 px-6">
      {/* Background photo */}
      <img
        src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/65" />
      {/* Background dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      <div className="relative mx-auto max-w-5xl text-center">
        <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-6">
          LEAP™ — Leadership Energy Alignment Profile &nbsp;·&nbsp; Powered by the Adizes PAEI Framework
        </p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
          Discover the hidden tensions<br className="hidden sm:block" /> shaping how you lead.
        </h1>
        <p className="text-lg text-white/90 max-w-2xl mx-auto mb-4">
          LEAP™ helps leaders understand the alignment between how they currently operate, what their role demands, and what naturally energizes them.
        </p>
        <p className="text-sm text-white/60 max-w-xl mx-auto mb-10">
          The result is a practical view into execution pressure, engagement strain, authenticity tension, and sustainable leadership effectiveness.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#0D1B2A] px-8 py-4 text-base font-bold hover:bg-blue-50 transition-colors shadow-lg"
          >
            Begin Your LEAP Assessment <ArrowRight className="h-5 w-5" />
          </button>
          <a
            href={SAMPLE_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/60 text-white px-8 py-4 text-base font-semibold hover:bg-white/10 transition-colors"
          >
            View a Sample LEAP Profile
          </a>
        </div>
        <div className="flex justify-center gap-8 mt-8 flex-wrap">
          {["~15 minutes", "Personalized leadership insights", "Immediate alignment profile", "Action-oriented guidance"].map((item) => (
            <span key={item} className="text-xs text-white/60 flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-white/40" />{item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function TensionCardsSection() {
  const cards = [
    {
      title: "Execution Gap",
      color: "#C8102E",
      bg: "#fee2e2",
      icon: <Target className="h-6 w-6" />,
      desc: "When your current operating patterns do not fully match your role demands.",
      example: '"Your role demands significantly more entrepreneurial energy than you are currently showing."',
    },
    {
      title: "Engagement Gap",
      color: "#E87722",
      bg: "#fef3c7",
      icon: <Zap className="h-6 w-6" />,
      desc: "When your role consistently draws on energies that do not naturally sustain you.",
      example: '"Your role may not fully utilize the energies you naturally enjoy and prefer to express."',
    },
    {
      title: "Authenticity Gap",
      color: "#1D3557",
      bg: "#dbeafe",
      icon: <Compass className="h-6 w-6" />,
      desc: "When how you currently operate drifts too far from what feels natural over time.",
      example: '"Sustained adaptation creates cognitive overhead."',
    },
  ];
  return (
    <section className="py-20 px-6 bg-white">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Most leadership strain is invisible—until it becomes costly.
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">LEAP surfaces the three core tensions that shape leadership sustainability.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-gray-100 p-6 bg-gray-50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: card.bg, color: card.color }}>
                  {card.icon}
                </div>
                <h3 className="font-bold text-gray-900" style={{ color: card.color }}>{card.title}</h3>
              </div>
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">{card.desc}</p>
              <p className="text-xs text-gray-500 italic leading-relaxed border-l-2 pl-3" style={{ borderColor: card.color }}>
                {card.example}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SampleInsightsSection() {
  return (
    <section className="py-20 px-6 bg-[#F8F9FC]">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Practical insights. Not personality labels.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 — Core Insight */}
          <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
            <p className="text-[10px] font-semibold text-[#1D3557] uppercase tracking-widest mb-2">Core Insight</p>
            <h4 className="font-bold text-gray-900 mb-3">Administrator (A) — Execution Gap</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              You are more process-focused than your role demands. While thoroughness is valuable,
              watch for over-engineering that slows decision-making.
            </p>
          </div>
          {/* Card 2 — Early Warning Signs */}
          <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-2">Early Warning Signs</p>
            <h4 className="font-bold text-gray-900 mb-3">Patterns to watch</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              {[
                "Under-delivering on process expectations",
                "Role demands innovation beyond current engagement level",
                "Operating with more A-behavior than feels natural",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-amber-500 flex-shrink-0 mt-0.5">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Card 3 — Action Path */}
          <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
            <p className="text-[10px] font-semibold text-[#2A9D8F] uppercase tracking-widest mb-2">Action Path</p>
            <h4 className="font-bold text-gray-900 mb-3">Protect — Producer</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              "Your Producer dimension shows the strongest alignment across Current State,
              Role Expectations, and Intrinsic Preference."
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyDifferentSection() {
  const rows = [
    ["Personality categorization", "Alignment visibility"],
    ["Static labels", "Dynamic tension mapping"],
    ["Generic strengths", "Context-aware insights"],
    ["Trait descriptions", "Role-energy analysis"],
    ["Self-expression focus", "Leadership effectiveness focus"],
  ];
  return (
    <section className="py-20 px-6 bg-white">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            LEAP maps leadership tension—not personality types.
          </h2>
        </div>
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-100">
            <div className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">Traditional Assessments</div>
            <div className="px-6 py-3 text-xs font-semibold text-[#1D3557] uppercase tracking-widest">LEAP™</div>
          </div>
          {rows.map(([left, right], i) => (
            <div key={i} className={`grid grid-cols-2 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
              <div className="px-6 py-4 text-sm text-gray-500 border-r border-gray-100">{left}</div>
              <div className="px-6 py-4 text-sm text-gray-900 font-medium">{right}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhatYouReceiveSection() {
  const items = [
    { icon: <BarChart3 className="h-5 w-5" />, title: "Energy Alignment Matrix", desc: "See how Current State, Role Expectations, and Intrinsic Preferences align across P, A, E, and I dimensions." },
    { icon: <Target className="h-5 w-5" />, title: "Gap Map", desc: "Identify your largest execution, engagement, and authenticity tensions." },
    { icon: <TrendingUp className="h-5 w-5" />, title: "What This Means", desc: "Translate patterns into practical leadership implications." },
    { icon: <Shield className="h-5 w-5" />, title: "Early Warning Signals", desc: "Surface patterns that may create friction, strain, or leadership drift." },
    { icon: <Compass className="h-5 w-5" />, title: "Action Path", desc: "Receive practical reflection and development guidance." },
  ];
  return (
    <section className="py-20 px-6 bg-[#F8F9FC]">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Your LEAP Profile Includes</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-xl bg-[#1D3557]/10 text-[#1D3557] flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h4 className="font-bold text-gray-900 mb-2">{item.title}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RealLeadershipSection() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-5">
          Built for the complexity of real leadership.
        </h2>
        <p className="text-gray-600 text-lg mb-4 leading-relaxed">
          Leadership is rarely static. Roles evolve. Organizations change. People adapt.
        </p>
        <p className="text-gray-500 leading-relaxed">
          LEAP is designed to help leaders understand where adaptation is healthy, where tension
          is becoming costly, and where alignment can improve sustainability and effectiveness.
        </p>
      </div>
    </section>
  );
}

function NoIdealProfilesSection() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-5">There are no ideal profiles.</h2>
        <p className="text-gray-600 text-lg mb-4 leading-relaxed">
          Every leadership energy carries strengths—and risks when overextended.
        </p>
        <p className="text-gray-500 leading-relaxed max-w-xl mx-auto">
          LEAP is not designed to judge or rank leaders. Its purpose is to make visible hidden pressures,
          sustainable strengths, energy drains, and alignment opportunities.
          <strong className="text-gray-700"> The goal is awareness, not categorization.</strong>
        </p>
      </div>
    </section>
  );
}

function OrgApplicationsSection() {
  const useCases = [
    "Executive coaching", "Leadership development", "Succession planning",
    "Team alignment", "Role redesign", "Transformation initiatives", "Organizational integration work",
  ];
  return (
    <section className="py-20 px-6 bg-[#F8F9FC]">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Designed for leaders, teams, and organizational transformation.
          </h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {useCases.map((item) => (
            <span key={item} className="rounded-full border border-[#1D3557]/20 bg-white px-5 py-2.5 text-sm font-medium text-[#1D3557]">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  const navigate = useNavigate();
  return (
    <section className="py-24 px-6 bg-[#0D1B2A] text-white text-center">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-3xl sm:text-4xl font-bold mb-5">
          Discover where your leadership energy is aligned.
        </h2>
        <p className="text-blue-200 mb-10 text-lg">
          Gain insight into the hidden tensions shaping your leadership effectiveness.
        </p>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#0D1B2A] px-10 py-4 text-base font-bold hover:bg-blue-50 transition-colors shadow-lg"
        >
          Begin Your LEAP Assessment <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-6 text-xs text-blue-300/50">
          LEAP™ is powered by the Adizes PAEI Framework · Operated by HILeadership in partnership with Turiyaskills
        </p>
      </div>
    </section>
  );
}

export function LeapLanding() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <TensionCardsSection />
      <SampleInsightsSection />
      <WhyDifferentSection />
      <WhatYouReceiveSection />
      <RealLeadershipSection />
      <NoIdealProfilesSection />
      <OrgApplicationsSection />
      <FinalCTASection />
    </div>
  );
}
