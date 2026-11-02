import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  ShieldCheck,
  Lock,
  ArrowRight,
  ExternalLink,
  Mail,
  FileText,
  UserCheck,
  Database,
  Brain,
  CreditCard,
  Video,
  Globe,
  Trash2,
  AlertCircle,
  HelpCircle,
  ArrowLeft
} from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    { id: "introduction", num: "1", title: "Introduction" },
    { id: "information-we-collect", num: "2", title: "Information We Collect" },
    { id: "how-we-use-information", num: "3", title: "How We Use Your Information" },
    { id: "ai-features", num: "4", title: "Artificial Intelligence Features & Third-Party AI Providers" },
    { id: "payments-and-transactions", num: "5", title: "Payments and Transactions" },
    { id: "live-classes-recordings", num: "6", title: "Live Classes, Webinars and Recordings" },
    { id: "storage-and-protection", num: "7", title: "How We Store and Protect Information" },
    { id: "sharing-of-information", num: "8", title: "Sharing of Information" },
    { id: "cookies-technologies", num: "9", title: "Cookies and Similar Technologies" },
    { id: "data-retention", num: "10", title: "Data Retention" },
    { id: "privacy-rights-deletion", num: "11", title: "Your Privacy Rights and Account Deletion" },
    { id: "childrens-privacy", num: "12", title: "Children's Privacy" },
    { id: "third-party-services", num: "13", title: "Third-Party Services and Links" },
    { id: "international-transfers", num: "14", title: "International Data Transfers" },
    { id: "policy-changes", num: "15", title: "Changes to This Privacy Policy" },
    { id: "contact-us", num: "16", title: "Contact Us" },
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
              onClick={() => navigate("/terms")}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Terms of Service
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
            <ShieldCheck className="w-4 h-4" />
            Legal & Data Protection
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            STEM Genius Privacy Policy
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground">
            How we collect, use, store, protect, and handle personal information across our platform.
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
                <p className="text-[11px] text-muted-foreground mb-2">Need to delete your account or have privacy inquiries?</p>
                <a
                  href="mailto:timisquare1@gmail.com?subject=STEM%20Genius%20Privacy%20Inquiry"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                >
                  <Mail className="w-3.5 h-3.5" />
                  timisquare1@gmail.com
                </a>
              </div>
            </div>
          </aside>

          {/* Policy Document Body */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-8 max-w-3xl">
            {/* Quick Summary Notice */}
            <Card className="p-4 sm:p-5 rounded-xl border-primary/20 bg-primary/5 flex items-start gap-3">
              <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-foreground/90 space-y-1">
                <p className="font-semibold text-foreground">Your Privacy Matters to Us</p>
                <p className="text-muted-foreground leading-relaxed">
                  We do not sell your personal information. Our data collection is designed to provide secure authentication, personalised educational tools, and compliant platform features.
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
                  STEM Genius is an integrated digital learning platform designed to help students access educational resources, prepare for examinations, connect with tutors, participate in online classes and improve their learning experiences through technology and artificial intelligence.
                </p>
                <p>
                  We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how STEM Genius collects, uses, stores, processes and shares information when you access or use our website, applications and services.
                </p>
                <p className="text-foreground font-medium border-l-2 border-primary pl-3 bg-primary/5 py-1.5 rounded-r-md">
                  By using STEM Genius, you acknowledge this Privacy Policy.
                </p>
              </Card>
            </section>

            {/* 2. Information We Collect */}
            <section id="information-we-collect" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">2</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Information We Collect</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-6 text-sm sm:text-base leading-relaxed">
                <p className="text-muted-foreground">
                  Depending on how you use STEM Genius, we may collect the following categories of information:
                </p>

                {/* A. Personal Information */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    A. Personal Information
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-sm pl-2">
                    <li>Full name.</li>
                    <li>Email address.</li>
                    <li>Phone number, where provided.</li>
                    <li>School, institution, faculty, department or academic level.</li>
                    <li>Profile picture, where provided.</li>
                    <li>Account and authentication-related information.</li>
                  </ul>
                </div>

                {/* B. Google Account Information */}
                <div className="space-y-3 rounded-xl bg-primary/5 border border-primary/20 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    B. Google Account Information
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    If you register or sign in using Google, we may receive information made available through Google authentication, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm pl-2">
                    <li>Your name.</li>
                    <li>Your email address.</li>
                    <li>Your Google profile picture, where available.</li>
                  </ul>
                  <p className="text-muted-foreground text-sm">
                    We use this information to authenticate your identity, create or access your STEM Genius account and support account-related functionality.
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    We do not receive your Google account password through this authentication process.
                  </p>
                  <div className="p-3 rounded-lg bg-background/80 border border-border/60 text-xs sm:text-sm text-foreground/90 space-y-1">
                    <span className="font-semibold text-primary block">Google API Limited Use Compliance:</span>
                    We do not sell Google user data or use it for unrelated advertising purposes. Our handling of Google user data is intended to comply with Google&apos;s applicable API Services User Data Policy, including its Limited Use requirements.
                  </div>
                </div>

                {/* C. Educational Information */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-500" />
                    C. Educational Information
                  </h3>
                  <p className="text-muted-foreground text-sm">When you use our educational services, we may collect:</p>
                  <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-sm pl-2">
                    <li>Examination responses and scores.</li>
                    <li>Quiz and CBT performance.</li>
                    <li>Learning progress and activity.</li>
                    <li>Academic resources you upload or access.</li>
                    <li>Questions, answers and learning materials you submit.</li>
                    <li>Subject preferences and areas of academic interest.</li>
                  </ul>
                </div>

                {/* D. User-Generated Content */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-500" />
                    D. User-Generated Content
                  </h3>
                  <p className="text-muted-foreground text-sm">We may collect content you submit or create through STEM Genius, including:</p>
                  <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-sm pl-2">
                    <li>Tutor profiles and descriptions.</li>
                    <li>Educational documents and past questions.</li>
                    <li>Questions, comments and feedback.</li>
                    <li>Live-class participation information.</li>
                    <li>Educational videos and other uploaded content.</li>
                  </ul>
                </div>

                {/* E. Technical and Usage Information */}
                <div className="space-y-2 rounded-xl bg-secondary/30 border border-border/50 p-4 sm:p-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-500" />
                    E. Technical and Usage Information
                  </h3>
                  <p className="text-muted-foreground text-sm">We may collect technical information such as:</p>
                  <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-sm pl-2">
                    <li>Device type and browser information.</li>
                    <li>IP address and general usage information.</li>
                    <li>Pages and features accessed.</li>
                    <li>Login activity and session information.</li>
                    <li>Error reports and performance information.</li>
                  </ul>
                </div>
              </Card>
            </section>

            {/* 3. How We Use Your Information */}
            <section id="how-we-use-information" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">3</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">How We Use Your Information</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-3 text-sm sm:text-base leading-relaxed">
                <p className="text-muted-foreground">We use collected information to:</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-muted-foreground text-sm pt-2">
                  {[
                    "Create, manage and authenticate user accounts.",
                    "Provide educational resources and learning services.",
                    "Generate examination questions and support CBT activities.",
                    "Personalise educational experiences and learning recommendations.",
                    "Facilitate tutor discovery, bookings and interactions.",
                    "Support live classes, webinars and related platform activities.",
                    "Provide AI-assisted educational features.",
                    "Process payments and manage applicable subscriptions or transactions.",
                    "Record, store and provide access to authorised class recordings.",
                    "Improve platform performance, reliability and security.",
                    "Communicate important account, service and security updates.",
                    "Detect fraudulent, abusive or unauthorised activities.",
                    "Comply with applicable legal obligations."
                  ].map((useCase, idx) => (
                    <li key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/20 border border-border/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span>{useCase}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>

            {/* 4. Artificial Intelligence Features */}
            <section id="ai-features" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">4</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  Artificial Intelligence Features and Third-Party AI Providers
                </h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  STEM Genius integrates AI-assisted services to improve educational experiences. These services may include educational assistance, question generation, language translation, voice-based learning support and other AI-powered functionality.
                </p>
                <div>
                  <p className="font-semibold text-foreground mb-2">Our AI integrations include:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2 text-foreground/90">
                    <li>YarnGPT.</li>
                    <li>Google Gemini.</li>
                    <li>OpenAI.</li>
                    <li>Other AI service providers integrated into the platform where applicable.</li>
                  </ul>
                </div>
                <p>
                  When you interact with these features, information you submit, such as questions, prompts, text, audio or other relevant content, may be transmitted to the applicable AI service provider for processing.
                </p>
                <p>
                  These providers process information to perform the requested AI functionality, subject to their applicable terms, privacy policies and contractual arrangements.
                </p>
                <p>
                  We aim to limit the information transmitted to what is reasonably necessary to provide the requested functionality.
                </p>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-foreground space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Important AI Disclaimers & Safety
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    • AI-generated responses may contain inaccuracies. Users should independently verify important academic information.
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    • Please avoid submitting passwords, financial credentials or other highly sensitive personal information into AI tools.
                  </p>
                </div>
              </Card>
            </section>

            {/* 5. Payments and Transactions */}
            <section id="payments-and-transactions" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">5</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Payments and Transactions</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  STEM Genius may offer paid services, subscriptions, premium educational resources, tutoring bookings and other transactions.
                </p>
                <p>
                  We use integrated third-party payment services to facilitate applicable transactions.
                </p>
                <p>
                  Depending on the payment method and transaction, relevant information may be processed by the payment provider, including transaction references, payment status and information necessary to complete or verify payments.
                </p>
                <p>
                  Payment providers may independently process certain financial information under their own privacy policies and applicable terms.
                </p>
                <div>
                  <p className="font-semibold text-foreground mb-2">STEM Genius uses relevant transaction information to:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Confirm payments.</li>
                    <li>Validate bookings and subscriptions.</li>
                    <li>Provide access to paid services.</li>
                    <li>Resolve payment disputes.</li>
                    <li>Detect fraudulent transactions.</li>
                    <li>Maintain transaction records where necessary.</li>
                  </ul>
                </div>
                <p className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs sm:text-sm text-foreground">
                  We do not intentionally request that users submit payment card passwords or other confidential banking credentials through ordinary platform messages or educational forms.
                </p>
              </Card>
            </section>

            {/* 6. Live Classes, Webinars and Recordings */}
            <section id="live-classes-recordings" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">6</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Live Classes, Webinars and Recordings</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  STEM Genius provides live educational sessions and may support the recording and playback of classes.
                </p>
                <div>
                  <p className="font-semibold text-foreground mb-2">Where recording functionality is enabled, class recordings may contain:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Audio and video of participating individuals.</li>
                    <li>Screen-sharing content.</li>
                    <li>Class discussions and presentations.</li>
                    <li>Participant names or other information displayed during a session.</li>
                  </ul>
                </div>
                <p>
                  Recordings may be stored and made accessible to authorised users for educational purposes, depending on the class settings and permissions.
                </p>
                <p>
                  Hosts and participants should be informed when a session is being recorded. Users should avoid sharing unnecessary personal or sensitive information during recorded sessions.
                </p>
                <p>
                  Access to recordings may be restricted according to class permissions, platform settings and applicable rules.
                </p>
              </Card>
            </section>

            {/* 7. How We Store and Protect Information */}
            <section id="storage-and-protection" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">7</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">How We Store and Protect Information</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  STEM Genius uses third-party technology infrastructure to operate its services.
                </p>
                <p className="p-3.5 rounded-xl bg-secondary/40 border border-border/60 text-foreground font-medium">
                  Our current infrastructure includes <strong className="text-primary">Supabase</strong> for backend services such as authentication, database functionality and file storage.
                </p>
                <p>
                  We take reasonable technical and organisational measures to protect personal information against unauthorised access, disclosure, alteration, loss or destruction.
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground/80 italic">
                  However, no online service or electronic storage system can be guaranteed to be completely secure.
                </p>
              </Card>
            </section>

            {/* 8. Sharing of Information */}
            <section id="sharing-of-information" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">8</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Sharing of Information</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground text-base">
                  We do not sell your personal information.
                </p>
                <p>We may share information with service providers where necessary to operate STEM Genius, including:</p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-foreground/90">
                  <li>Authentication and backend infrastructure providers.</li>
                  <li>Cloud hosting and storage providers.</li>
                  <li>AI service providers, including YarnGPT, Google Gemini and OpenAI.</li>
                  <li>Payment service providers.</li>
                  <li>Other technology providers necessary to deliver platform functionality.</li>
                </ul>
                <p>
                  Information may also be shared with other users where necessary to provide platform features. For example, relevant profile information may be visible to students searching for tutors.
                </p>
                <p>
                  We may disclose information where required by applicable law, to protect the rights and safety of users, or to investigate suspected fraud, abuse or security incidents.
                </p>
                <p>
                  We aim to limit information shared with third parties to what is reasonably necessary for the relevant purpose.
                </p>
              </Card>
            </section>

            {/* 9. Cookies and Similar Technologies */}
            <section id="cookies-technologies" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">9</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Cookies and Similar Technologies</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>STEM Genius may use cookies, local storage and similar technologies to:</p>
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  <li>Maintain login sessions.</li>
                  <li>Remember relevant preferences.</li>
                  <li>Support essential platform functionality.</li>
                  <li>Improve performance and user experience.</li>
                </ul>
                <p>
                  You can manage cookies through your browser settings, although disabling certain technologies may affect platform functionality.
                </p>
              </Card>
            </section>

            {/* 10. Data Retention */}
            <section id="data-retention" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">10</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Data Retention</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  We retain personal information for as long as reasonably necessary to provide our services, maintain accounts, meet legitimate operational requirements and comply with applicable legal obligations.
                </p>
                <p>
                  Educational records, transaction information, uploaded resources and class recordings may be retained according to their purpose, applicable platform settings and relevant legal requirements.
                </p>
                <p>
                  Where information is no longer required, we will take reasonable steps to delete or anonymise it, subject to applicable legal and technical requirements.
                </p>
              </Card>
            </section>

            {/* 11. Your Privacy Rights and Account Deletion */}
            <section id="privacy-rights-deletion" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">11</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  Your Privacy Rights and Account Deletion
                </h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>Depending on applicable law, you may have the right to:</p>
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  <li>Request access to your personal information.</li>
                  <li>Request correction of inaccurate information.</li>
                  <li>Request deletion of your account and associated personal information.</li>
                  <li>Withdraw consent where processing is based on consent.</li>
                  <li>Object to or request restriction of certain processing activities.</li>
                  <li>Ask questions about how your information is handled.</li>
                </ul>

                {/* Account Deletion Box */}
                <div className="p-5 sm:p-6 rounded-2xl bg-destructive/5 border border-destructive/20 text-foreground space-y-4">
                  <div className="flex items-center gap-2 text-base font-bold text-foreground">
                    <Trash2 className="w-5 h-5 text-destructive" />
                    How to request account deletion
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    To request deletion of your STEM Genius account and associated personal information, send an email to:
                  </p>
                  <div className="p-3 rounded-xl bg-background/80 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground font-medium">Send email to:</div>
                      <a
                        href="mailto:timisquare1@gmail.com?subject=STEM%20Genius%20Account%20Deletion%20Request"
                        className="text-primary font-bold text-sm sm:text-base hover:underline flex items-center gap-1.5"
                      >
                        <Mail className="w-4 h-4" />
                        timisquare1@gmail.com
                      </a>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-xs text-muted-foreground font-medium">Use Subject Line:</div>
                      <code className="text-xs font-mono font-semibold text-foreground px-2 py-1 rounded bg-secondary">
                        STEM Genius Account Deletion Request
                      </code>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Include the email address associated with your STEM Genius account so that we can identify and verify your request.
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    We will review your request and take appropriate steps in accordance with applicable data protection laws. Some information may need to be retained where required by law, necessary to resolve disputes, or required for legitimate security and transaction-record purposes.
                  </p>
                </div>
              </Card>
            </section>

            {/* 12. Children's Privacy */}
            <section id="childrens-privacy" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">12</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Children&apos;s Privacy</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  STEM Genius is designed for students and educational users.
                </p>
                <p>
                  Where users are minors, their use of the platform must comply with applicable age, parental consent and child protection requirements.
                </p>
                <p>
                  We do not knowingly collect children&apos;s personal information in violation of applicable law. Where required, we will take appropriate steps to obtain parental or guardian consent.
                </p>
              </Card>
            </section>

            {/* 13. Third-Party Services and Links */}
            <section id="third-party-services" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">13</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Third-Party Services and Links</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  STEM Genius may contain links to external websites and services.
                </p>
                <p>
                  These services operate under their own privacy policies and terms. We are not responsible for the privacy practices of external services that we do not control.
                </p>
              </Card>
            </section>

            {/* 14. International Data Transfers */}
            <section id="international-transfers" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">14</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">International Data Transfers</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  Some of our technology service providers may process or store information in countries other than the country where you reside.
                </p>
                <p>
                  Where applicable, we take reasonable steps to ensure that such processing is subject to appropriate data protection safeguards.
                </p>
              </Card>
            </section>

            {/* 15. Changes to This Privacy Policy */}
            <section id="policy-changes" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">15</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Changes to This Privacy Policy</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  We may update this Privacy Policy when our services, technology or legal obligations change.
                </p>
                <p>
                  Where appropriate, we will notify users of significant changes through the platform or other suitable communication channels.
                </p>
                <p className="font-semibold text-foreground">
                  The latest version will always be made available on this page.
                </p>
              </Card>
            </section>

            {/* 16. Contact Us */}
            <section id="contact-us" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Badge className="h-7 w-7 rounded-lg p-0 flex items-center justify-center text-xs font-bold">16</Badge>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Contact Us</h2>
              </div>
              <Card className="p-6 sm:p-8 rounded-2xl border-border/60 glass-card space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                <p>
                  For questions, privacy requests, account deletion requests or concerns about this Privacy Policy, please contact:
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
                onClick={() => navigate("/terms")}
                className="gap-2"
              >
                View Terms of Service
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
                <li><Link to="/privacy" className="text-primary font-medium hover:underline">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
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

