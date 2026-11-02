import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Scale,
  FileCheck,
  ArrowRight,
  ExternalLink,
  Mail,
  FileText,
  UserCheck,
  Brain,
  Video,
  BookOpen,
  Award,
  Users,
  AlertTriangle,
  ShieldAlert,
  ArrowLeft,
  DollarSign
} from "lucide-react";

export default function TermsOfService() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    { id: "introduction", num: "1", title: "Introduction" },
    { id: "eligibility", num: "2", title: "Eligibility and User Accounts" },
    { id: "platform-services", num: "3", title: "Platform Services" },
    { id: "user-responsibilities", num: "4", title: "User Responsibilities" },
    { id: "user-generated-content", num: "5", title: "User-Generated Content" },
    { id: "intellectual-property", num: "6", title: "Intellectual Property" },
    { id: "payments-subscriptions", num: "7", title: "Payments, Subscriptions and Refunds" },
    { id: "tutor-responsibilities", num: "8", title: "Tutor Responsibilities" },
    { id: "privacy-personal-info", num: "9", title: "Privacy and Personal Information" },
    { id: "platform-availability", num: "10", title: "Platform Availability" },
    { id: "educational-disclaimer", num: "11", title: "Educational Disclaimer" },
    { id: "limitation-liability", num: "12", title: "Limitation of Liability" },
    { id: "suspension-termination", num: "13", title: "Suspension and Termination" },
    { id: "changes-to-terms", num: "14", title: "Changes to These Terms" },
    { id: "governing-law", num: "15", title: "Governing Law" },
    { id: "contact-information", num: "16", title: "Contact Information" },
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-foreground">
              STEM <span className="text-primary">Genius</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hidden sm:inline-flex"
            >
              Home
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/about")}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              About Us
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/privacy")}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Privacy Policy
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-xs sm:text-sm font-semibold shadow-sm"
            >
              Dashboard
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </nav>
        </div>
      </header>

      {/* ── HERO BANNER ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-14 border-b border-border/40 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase">
            <Scale className="w-4 h-4" />
            Legal Agreement
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            STEM Genius Terms of Service
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground">
            The terms, conditions, and rules governing your access to and use of STEM Genius.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs sm:text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 border border-border/50">
              <span className="font-medium text-foreground">Effective Date:</span> 31 October 2026
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 border border-border/50">
              <span className="font-medium text-foreground">Last Updated:</span> 31 October 2026
            </span>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Table of Contents (Sticky on Desktop) */}
          <aside className="lg:col-span-4 xl:col-span-3 hidden lg:block">
            <div className="sticky top-24 p-5 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <FileText className="w-4 h-4" />
                Table of Contents
              </div>
              <nav className="space-y-1 text-xs">
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className="w-full text-left py-1.5 px-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors flex items-start gap-2"
                  >
                    <span className="text-primary font-bold shrink-0">{sec.num}.</span>
                    <span className="truncate">{sec.title}</span>
                  </button>
                ))}
              </nav>

              <div className="pt-4 border-t border-border/50">
                <p className="text-[11px] text-muted-foreground mb-2">Questions or concerns about these Terms?</p>
                <a
                  href="mailto:timisquare1@gmail.com?subject=STEM%20Genius%20Terms%20Inquiry"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                >
                  <Mail className="w-3.5 h-3.5" />
                  timisquare1@gmail.com
                </a>
              </div>
            </div>
          </aside>

          {/* Terms Document Body */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-8 max-w-3xl">
            {/* Agreement Notice */}
            <Card className="p-4 sm:p-5 rounded-xl border-primary/20 bg-primary/5 flex items-start gap-3">
              <FileCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-foreground/90 space-y-1">
                <p className="font-semibold text-foreground">User Agreement</p>
                <p className="text-muted-foreground leading-relaxed">
                  By creating an account or using STEM Genius, you agree to comply with and be bound by these Terms. If you do not agree, you should discontinue using the platform.
                </p>
              </div>
            </Card>

            {/* 1. Introduction */}
            <section id="introduction" className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">1</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Introduction</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>Welcome to <strong className="text-foreground">STEM Genius</strong>.</p>
                <p>
                  These Terms of Service govern your access to and use of the STEM Genius website, applications, educational resources and related services.
                </p>
                <p>
                  STEM Genius is an integrated educational platform designed to connect students with academic resources, examination preparation tools, AI-assisted learning, tutors, live classes and other educational opportunities.
                </p>
                <p className="text-foreground font-medium border-l-2 border-primary pl-3 bg-primary/5 py-1.5 rounded-r-md">
                  By creating an account or using our services, you agree to these Terms. If you do not agree, you should discontinue using the platform.
                </p>
              </Card>
            </section>

            {/* 2. Eligibility and User Accounts */}
            <section id="eligibility" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">2</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Eligibility and User Accounts</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base leading-relaxed">
                <p className="text-muted-foreground">
                  To use STEM Genius, you must provide accurate information when registering and maintain the security of your account.
                </p>
                <div>
                  <p className="font-semibold text-foreground mb-2">You agree to:</p>
                  <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-sm pl-2">
                    <li>Provide truthful and current registration information.</li>
                    <li>Keep your login credentials confidential.</li>
                    <li>Avoid sharing your account with unauthorised individuals.</li>
                    <li>Notify us if you suspect unauthorised access.</li>
                    <li>Use the platform in compliance with applicable laws.</li>
                  </ul>
                </div>
                <p className="text-muted-foreground text-sm">
                  Where a user is a minor, their use of STEM Genius must comply with applicable parental or guardian consent requirements.
                </p>
                <p className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs sm:text-sm text-foreground">
                  We reserve the right to suspend or restrict accounts involved in fraudulent, abusive or prohibited activities.
                </p>
              </Card>
            </section>

            {/* 3. Platform Services */}
            <section id="platform-services" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">3</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Platform Services</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-6 text-sm sm:text-base leading-relaxed">
                <p className="text-muted-foreground">
                  STEM Genius may provide access to the following services:
                </p>

                {/* A. AI-Assisted Learning */}
                <div className="space-y-3 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    A. AI-Assisted Learning
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Users may access AI-powered educational tools to ask questions, clarify concepts, generate practice questions, translate learning content and support their learning.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    These features may use third-party AI services, including YarnGPT, Google Gemini, OpenAI and other integrated providers.
                  </p>
                  <p className="text-sm font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                    AI-generated responses are provided for educational assistance and may contain inaccuracies. They should not be treated as guaranteed correct answers.
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Users should avoid submitting confidential credentials or highly sensitive personal information into AI tools.
                  </p>
                </div>

                {/* B. Computer-Based Tests and Examinations */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-500" />
                    B. Computer-Based Tests and Examinations
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Users may access practice examinations, quizzes, assessments and other examination preparation tools.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Scores and feedback are intended to support learning and may not represent official examination results.
                  </p>
                  <p className="text-sm font-medium text-destructive">
                    Users must not attempt to manipulate assessment systems, examination results or platform scoring mechanisms.
                  </p>
                </div>

                {/* C. University Library */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-sky-500" />
                    C. University Library
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Users may access academic resources, past questions, study materials and other educational documents.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Access to certain resources may be restricted by subscription status, institutional permissions or platform rules.
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    Users must not redistribute, sell or commercially exploit resources without the necessary authorisation.
                  </p>
                </div>

                {/* D. Tutor Marketplace */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    D. Tutor Marketplace
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    STEM Genius may allow tutors to create profiles, display their expertise and offer tutoring services.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Students may discover tutors, request sessions and participate in tutoring arrangements through the platform.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Tutors are responsible for providing accurate information about their qualifications, experience, availability and pricing.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Where payments or bookings are supported, applicable fees and conditions will be communicated through the platform.
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground italic">
                    STEM Genius does not guarantee any particular academic outcome from tutoring sessions.
                  </p>
                </div>

                {/* E. Live Classes and Webinars */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Video className="w-4 h-4 text-indigo-500" />
                    E. Live Classes and Webinars
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Users may participate in online classes, webinars and educational sessions.
                  </p>
                  <p className="text-muted-foreground text-sm font-medium text-foreground">
                    Participants must behave respectfully and must not disrupt sessions, harass other participants or misuse another participant&apos;s personal information.
                  </p>
                </div>

                {/* F. Class Recordings */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Video className="w-4 h-4 text-rose-500" />
                    F. Class Recordings
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    STEM Genius may support the recording, storage and playback of live classes.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Recordings may be made available to authorised participants for educational purposes, subject to class settings and permissions.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Users must respect the privacy of other participants and must not independently record, download, reproduce, publish or redistribute class recordings without appropriate authorisation.
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Where a session is recorded, hosts and participants should be appropriately informed.
                  </p>
                </div>

                {/* G. Educational Content and STEM Reels */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-amber-500" />
                    G. Educational Content and STEM Reels
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Users may be able to upload, view or interact with educational videos and other learning content.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Users remain responsible for ensuring that their contributions comply with intellectual property rights and platform rules.
                  </p>
                </div>
              </Card>
            </section>

            {/* 4. User Responsibilities */}
            <section id="user-responsibilities" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">4</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">User Responsibilities</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base leading-relaxed">
                <div className="flex items-center gap-2 text-destructive font-semibold">
                  <ShieldAlert className="w-5 h-5" />
                  Prohibited Activities
                </div>
                <p className="text-muted-foreground text-sm">You agree not to:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {[
                    "Use STEM Genius for unlawful purposes.",
                    "Impersonate another person or provide fraudulent information.",
                    "Attempt to gain unauthorised access to accounts, databases or systems.",
                    "Upload malware or malicious files.",
                    "Disrupt or interfere with platform operations.",
                    "Harass, threaten or abuse other users.",
                    "Upload content that infringes copyright or other intellectual property rights.",
                    "Manipulate examination results, bookings or platform payment systems.",
                    "Distribute unauthorised copies of premium educational materials.",
                    "Use the platform to distribute misleading, harmful or prohibited content.",
                    "Record or redistribute classes without appropriate permission.",
                    "Misuse other users' personal information."
                  ].map((rule, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/10 text-xs sm:text-sm">
                      <span className="text-destructive font-bold shrink-0">✕</span>
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* 5. User-Generated Content */}
            <section id="user-generated-content" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">5</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">User-Generated Content</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  You retain ownership of content you lawfully create and upload to STEM Genius, subject to any third-party rights.
                </p>
                <p>
                  By submitting content, you grant STEM Genius a non-exclusive, worldwide licence to host, store, display, reproduce and process that content as reasonably necessary to operate, maintain and provide the relevant platform services.
                </p>
                <p className="text-foreground font-medium">
                  You represent that you own or have the necessary permissions to upload and share the content.
                </p>
                <p>
                  We reserve the right to remove content that violates these Terms, applicable law or the rights of others.
                </p>
              </Card>
            </section>

            {/* 6. Intellectual Property */}
            <section id="intellectual-property" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">6</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Intellectual Property</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  STEM Genius and its original platform materials, branding, software, designs, features and associated intellectual property are owned by or licensed to STEM Genius, except where otherwise stated.
                </p>
                <p>
                  Users may not copy, modify, distribute, reverse engineer or commercially exploit our proprietary materials without prior written permission, except where permitted by applicable law.
                </p>
                <p className="font-semibold text-foreground">
                  Nothing in these Terms transfers ownership of STEM Genius intellectual property to users.
                </p>
              </Card>
            </section>

            {/* 7. Payments, Subscriptions and Refunds */}
            <section id="payments-subscriptions" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">7</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Payments, Subscriptions and Refunds</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  Certain services may be free, while others may require payment, subscription or transaction fees.
                </p>
                <p>
                  STEM Genius uses integrated third-party payment services to facilitate applicable transactions.
                </p>
                <p>
                  Prices, subscription conditions and applicable fees will be displayed before a transaction is completed.
                </p>
                <p>
                  Where third-party payment providers are used, their applicable payment terms may also apply.
                </p>
                <p>
                  Users are responsible for providing accurate payment information and ensuring that transactions are authorised.
                </p>
                <p>
                  Refund eligibility, cancellations and payment disputes will be handled according to the applicable service conditions and relevant consumer protection laws.
                </p>
                <p className="text-foreground font-medium">
                  Any additional refund policy published by STEM Genius will form part of these Terms.
                </p>
              </Card>
            </section>

            {/* 8. Tutor Responsibilities */}
            <section id="tutor-responsibilities" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">8</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Tutor Responsibilities</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base leading-relaxed">
                <p className="text-muted-foreground">Tutors using STEM Genius agree to:</p>
                <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-sm pl-2">
                  <li>Provide truthful information about their identity and qualifications.</li>
                  <li>Deliver services professionally and respectfully.</li>
                  <li>Honour confirmed tutoring arrangements.</li>
                  <li>Communicate pricing and availability accurately.</li>
                  <li>Respect student privacy and confidentiality.</li>
                  <li>Avoid fraudulent, discriminatory or abusive conduct.</li>
                </ul>
                <p className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs sm:text-sm text-foreground">
                  STEM Genius may review tutor profiles and take appropriate action where complaints, misconduct or policy violations are identified.
                </p>
              </Card>
            </section>

            {/* 9. Privacy and Personal Information */}
            <section id="privacy-personal-info" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">9</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Privacy and Personal Information</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  Your use of STEM Genius is also governed by our{" "}
                  <Link to="/privacy" className="text-primary font-semibold hover:underline">
                    Privacy Policy
                  </Link>.
                </p>
                <p>
                  By using the platform, you acknowledge that certain information may be collected and processed to provide authentication, educational services, communications, payment processing, AI-assisted functionality and other platform services.
                </p>
                <p className="text-foreground">
                  Please review our Privacy Policy for details about data collection, storage, processing and sharing.
                </p>
              </Card>
            </section>

            {/* 10. Platform Availability */}
            <section id="platform-availability" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">10</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Platform Availability</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  We aim to provide reliable access to STEM Genius. However, we do not guarantee uninterrupted or error-free operation.
                </p>
                <p>
                  The platform may occasionally experience maintenance, technical interruptions, service outages or changes to functionality.
                </p>
                <p>
                  We reserve the right to modify, suspend or discontinue features where reasonably necessary.
                </p>
              </Card>
            </section>

            {/* 11. Educational Disclaimer */}
            <section id="educational-disclaimer" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">11</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Educational Disclaimer</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-foreground space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-500 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Educational Outcomes & Content
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    STEM Genius provides educational tools and resources intended to support learning.
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium text-foreground">
                    We do not guarantee examination success, academic performance, admission outcomes or any particular educational result.
                  </p>
                </div>
                <p>
                  AI-generated content, educational resources and tutor-provided information should be assessed critically and verified where necessary.
                </p>
                <p className="text-foreground font-medium">
                  STEM Genius is not a substitute for professional medical, legal or other regulated professional advice.
                </p>
              </Card>
            </section>

            {/* 12. Limitation of Liability */}
            <section id="limitation-liability" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">12</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Limitation of Liability</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  To the extent permitted by applicable law, STEM Genius shall not be liable for indirect, incidental or consequential losses arising from the use of the platform.
                </p>
                <div>
                  <p className="font-semibold text-foreground mb-2">We are not responsible for:</p>
                  <ul className="list-disc list-inside space-y-1.5 pl-2 text-sm">
                    <li>Temporary platform interruptions.</li>
                    <li>Losses arising from inaccurate user-submitted information.</li>
                    <li>Unauthorised conduct by other users.</li>
                    <li>Academic outcomes or examination performance.</li>
                    <li>Third-party services outside our reasonable control.</li>
                  </ul>
                </div>
                <p className="text-xs sm:text-sm italic">
                  Nothing in these Terms excludes liability that cannot legally be excluded under applicable law.
                </p>
              </Card>
            </section>

            {/* 13. Suspension and Termination */}
            <section id="suspension-termination" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">13</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Suspension and Termination</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  We may suspend, restrict or terminate access to accounts that violate these Terms, applicable laws or platform safety requirements.
                </p>

                {/* Account Deletion Box */}
                <div className="p-5 sm:p-6 rounded-2xl bg-secondary/40 border border-border/60 text-foreground space-y-3">
                  <div className="text-sm font-semibold text-foreground">How to request account deletion:</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Users may request account deletion by sending an email to:
                  </p>
                  <div className="p-3 rounded-xl bg-background/80 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <a
                      href="mailto:timisquare1@gmail.com?subject=STEM%20Genius%20Account%20Deletion%20Request"
                      className="text-primary font-bold text-sm sm:text-base hover:underline flex items-center gap-1.5"
                    >
                      <Mail className="w-4 h-4" />
                      timisquare1@gmail.com
                    </a>
                    <div>
                      <span className="text-xs text-muted-foreground mr-2 font-medium">Subject:</span>
                      <code className="text-xs font-mono font-semibold text-foreground px-2 py-1 rounded bg-secondary">
                        STEM Genius Account Deletion Request
                      </code>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Include the email address associated with your account. We will review deletion requests and take appropriate steps, subject to applicable legal and operational retention requirements.
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground">
                  Termination does not automatically remove obligations or liabilities that arose before termination.
                </p>
              </Card>
            </section>

            {/* 14. Changes to These Terms */}
            <section id="changes-to-terms" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">14</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Changes to These Terms</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  We may update these Terms as STEM Genius develops or as applicable laws and operational requirements change.
                </p>
                <p>
                  Updated Terms will be published on this page with a revised effective date.
                </p>
                <p className="font-semibold text-foreground">
                  Continued use of STEM Genius after changes take effect constitutes acceptance of the updated Terms, to the extent permitted by applicable law.
                </p>
              </Card>
            </section>

            {/* 15. Governing Law */}
            <section id="governing-law" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">15</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Governing Law</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  These Terms shall be interpreted in accordance with applicable laws and regulations.
                </p>
                <p>
                  Where appropriate, disputes will be addressed through good-faith communication before pursuing other available legal remedies.
                </p>
              </Card>
            </section>

            {/* 16. Contact Information */}
            <section id="contact-information" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">16</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Contact Information</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  For questions, complaints or concerns relating to these Terms, please contact:
                </p>
                <div className="p-4 sm:p-5 rounded-xl bg-secondary/30 border border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Platform:</span>
                    <span className="text-foreground">STEM Genius</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Website:</span>
                    <a
                      href="https://stemgenius.tech"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      https://stemgenius.tech
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Support Email:</span>
                    <a
                      href="mailto:timisquare1@gmail.com"
                      className="text-primary hover:underline font-medium"
                    >
                      timisquare1@gmail.com
                    </a>
                  </div>
                </div>
              </Card>
            </section>

            {/* Bottom Navigation */}
            <div className="pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate("/privacy")}
                className="gap-2"
              >
                View Privacy Policy
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-card border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">STEM Genius</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Empowering African students to excel in STEM through AI-powered learning.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/ai-homework-helper" className="hover:text-primary transition-colors">AI Homework Helper</Link></li>
                <li><Link to="/voice-stem-tutor" className="hover:text-primary transition-colors">Voice STEM Tutor</Link></li>
                <li><Link to="/past-questions" className="hover:text-primary transition-colors">Past Questions & CBT</Link></li>
                <li><Link to="/tutors" className="hover:text-primary transition-colors">Tutor Marketplace</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
                <li><Link to="/dashboard" className="hover:text-primary transition-colors">Student Dashboard</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Sign In / Register</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-primary font-medium hover:underline">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-xs text-muted-foreground">
            <p>© 2026 STEM Genius. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

