import { useState } from "react";
import {
  ArrowRight, Search, Target, ClipboardList, Repeat,
  MessageCircle, Users, Award, X, CheckCircle2, Loader2,
} from "lucide-react";
import { submitCoachingLead } from "@/api/coaching";

function HeroSection({ onSchedule }: { onSchedule: () => void }) {
  return (
    <section className="relative overflow-hidden text-white py-24 px-6">
      <img
        src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1920&q=80"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/65" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-6">
          LEAP™ Coaching &nbsp;·&nbsp; Leadership Energy Alignment Profile
        </p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
          Turn Insight Into Action
        </h1>
        <p className="text-lg text-white/90 max-w-2xl mx-auto mb-4">
          Your LEAP report highlights where your energy, role expectations, and natural preferences
          align—and where tension may exist.
        </p>
        <p className="text-base text-white/70 max-w-2xl mx-auto mb-10">
          A coaching conversation helps transform those insights into practical development
          opportunities tailored to your unique situation.
        </p>
        <button
          onClick={onSchedule}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#0D1B2A] px-8 py-4 text-base font-bold hover:bg-blue-50 transition-colors shadow-lg"
        >
          Schedule a Conversation <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

function WhatCoachingHelpsSection() {
  const items = [
    { icon: <Search className="h-6 w-6" />, title: "Understand Your Results More Deeply", desc: "Explore the patterns behind your scores, gaps, strengths, and stress tendencies." },
    { icon: <Target className="h-6 w-6" />, title: "Focus on What Matters Most", desc: "Identify the few areas that will have the greatest impact on your effectiveness." },
    { icon: <ClipboardList className="h-6 w-6" />, title: "Build a Practical Development Plan", desc: "Translate awareness into meaningful actions that fit your role and responsibilities." },
    { icon: <Repeat className="h-6 w-6" />, title: "Sustain Growth Over Time", desc: "Develop habits and practices that help you lead with greater effectiveness and energy." },
  ];
  return (
    <section className="py-20 px-6 bg-white">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-3">What Coaching Helps You Do</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {items.map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-6 hover:shadow-md transition-shadow">
              <div className="h-11 w-11 rounded-xl bg-[#1D3557]/10 text-[#1D3557] flex items-center justify-center mb-4">{item.icon}</div>
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CoachingOptionsSection() {
  const options = [
    { icon: <MessageCircle className="h-6 w-6" />, color: "#C8102E", bg: "#fee2e2", title: "LEAP Debrief Session", meta: "90 minutes", desc: "Review the report and identify key insights." },
    { icon: <ClipboardList className="h-6 w-6" />, color: "#1D3557", bg: "#dbeafe", title: "LEAP Development Coaching", meta: "3–6 sessions", desc: "Explore specific development goals and build new leadership practices." },
    { icon: <Users className="h-6 w-6" />, color: "#2A9D8F", bg: "#ccfbf1", title: "Team or Organizational Applications", meta: "Tailored engagement", desc: "Use LEAP to improve team effectiveness, role alignment, and leadership development across groups." },
  ];
  return (
    <section className="py-20 px-6 bg-[#F8F9FC]">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Coaching Options</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((opt) => (
            <div key={opt.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4" style={{ background: opt.bg, color: opt.color }}>{opt.icon}</div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: opt.color }}>{opt.meta}</p>
              <h3 className="font-bold text-gray-900 mb-3">{opt.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{opt.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyCertifiedCoachSection() {
  const training = ["LEAP™", "Adizes Principles", "Leadership Development", "Human-Centered Growth Practices"];
  return (
    <section className="py-20 px-6 bg-white">
      <div className="mx-auto max-w-3xl text-center">
        <div className="h-12 w-12 rounded-2xl bg-[#1D3557]/10 text-[#1D3557] flex items-center justify-center mx-auto mb-6">
          <Award className="h-6 w-6" />
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-5">Why Work With a Certified LEAP Coach?</h2>
        <p className="text-gray-600 mb-8">Certified LEAP coaches are trained in:</p>
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {training.map((item) => (
            <span key={item} className="rounded-full border border-[#1D3557]/20 bg-[#F8F9FC] px-5 py-2.5 text-sm font-medium text-[#1D3557]">{item}</span>
          ))}
        </div>
        <p className="text-gray-500 leading-relaxed max-w-xl mx-auto">
          They help participants interpret results in context rather than relying solely on scores or labels.
        </p>
      </div>
    </section>
  );
}

function FinalCTASection({ onSchedule }: { onSchedule: () => void }) {
  return (
    <section className="py-24 px-6 bg-[#0D1B2A] text-white text-center">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-3xl sm:text-4xl font-bold mb-5">Ready to Continue the Conversation?</h2>
        <p className="text-blue-200 mb-10 text-lg">
          Schedule an introductory conversation to explore whether LEAP coaching is right for you.
        </p>
        <button
          onClick={onSchedule}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#0D1B2A] px-10 py-4 text-base font-bold hover:bg-blue-50 transition-colors shadow-lg mb-10"
        >
          Schedule a Conversation <ArrowRight className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center gap-2">
          <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-10 w-auto opacity-70 mb-1" />
          <p className="text-xs text-blue-300/50">
            LEAP™ — Leadership Energy Alignment Profile &nbsp;·&nbsp; Developed by Heartfulness Institute of Leadership &nbsp;·&nbsp; Powered by the Adizes PAEI Framework
          </p>
        </div>
      </div>
    </section>
  );
}

function LeadFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", organization: "", message: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  if (!open) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const close = () => {
    onClose();
    // reset shortly after closing so the success state isn't visible while it fades
    setTimeout(() => { setStatus("idle"); setForm({ name: "", email: "", phone: "", organization: "", message: "" }); setError(""); }, 200);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    setStatus("submitting"); setError("");
    try {
      await submitCoachingLead({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        organization: form.organization.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again, or email hello@hileadership.org.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={close}>
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} aria-label="Close" className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
          <X className="h-5 w-5" />
        </button>

        {status === "done" ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-[#2A9D8F] mx-auto mb-4" />
            <h3 className="font-display text-2xl font-bold text-gray-900 mb-2">Thank you!</h3>
            <p className="text-gray-600">
              Your request has been received. A member of the LEAP team will be in touch shortly.
            </p>
            <button onClick={close} className="mt-6 rounded-xl bg-[#1D3557] text-white px-6 py-3 text-sm font-semibold hover:bg-[#16293f] transition-colors">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-8">
            <h3 className="font-display text-2xl font-bold text-gray-900 mb-1">Schedule a Conversation</h3>
            <p className="text-sm text-gray-500 mb-6">Tell us a little about you and we'll reach out to set up an introductory LEAP coaching conversation.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Name <span className="text-[#C8102E]">*</span></label>
                <input value={form.name} onChange={set("name")} required className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]/30 focus:border-[#1D3557]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email <span className="text-[#C8102E]">*</span></label>
                <input type="email" value={form.email} onChange={set("email")} required className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]/30 focus:border-[#1D3557]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={set("phone")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]/30 focus:border-[#1D3557]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Organization</label>
                  <input value={form.organization} onChange={set("organization")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]/30 focus:border-[#1D3557]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">What would you like coaching to help with?</label>
                <textarea value={form.message} onChange={set("message")} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]/30 focus:border-[#1D3557]" />
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-[#C8102E]">{error}</p>}

            <button type="submit" disabled={status === "submitting"}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#C8102E] text-white px-6 py-3.5 text-base font-bold hover:bg-[#a50d26] transition-colors disabled:opacity-60">
              {status === "submitting" ? (<><Loader2 className="h-5 w-5 animate-spin" /> Sending…</>) : (<>Request a Conversation <ArrowRight className="h-5 w-5" /></>)}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function LeapCoaching() {
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = () => setModalOpen(true);
  return (
    <div className="min-h-screen">
      <HeroSection onSchedule={openModal} />
      <WhatCoachingHelpsSection />
      <CoachingOptionsSection />
      <WhyCertifiedCoachSection />
      <FinalCTASection onSchedule={openModal} />
      <LeadFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
