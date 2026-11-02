import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  GraduationCap, Target, Eye, Heart, Sparkles, BookOpen, 
  Users, Video, ArrowRight, ArrowLeft, CheckCircle2, 
  Lightbulb, ShieldCheck, Compass, Award, Quote, Code, 
  Stethoscope, Palette, Bot, ExternalLink
} from "lucide-react";

import founderImg from "@/assets/founder-toriola-paul.png";
import cofounderImg from "@/assets/cofounder-kafayat-adeneye.jpg";

export default function AboutUs() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToFounders = () => {
    const el = document.getElementById("founders");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const coreValues = [
    {
      title: "Accessibility",
      description: "Make learning resources and past examination papers easier to find, open, and use for all students.",
      icon: <BookOpen className="w-5 h-5 text-primary" />
    },
    {
      title: "Innovation",
      description: "Use technology and thoughtful digital tools to continuously improve how students learn and revise.",
      icon: <Lightbulb className="w-5 h-5 text-amber-500" />
    },
    {
      title: "Student-Centred Design",
      description: "Build every tool, interface, and workflow around the real everyday needs and pressures of students.",
      icon: <Heart className="w-5 h-5 text-rose-500" />
    },
    {
      title: "Collaboration",
      description: "Encourage active knowledge sharing, peer tutoring, and academic support within a supportive community.",
      icon: <Users className="w-5 h-5 text-emerald-500" />
    },
    {
      title: "Continuous Learning",
      description: "Support lifelong academic curiosity, personal growth, and intellectual development at every level.",
      icon: <Compass className="w-5 h-5 text-sky-500" />
    }
  ];

  const features = [
    {
      title: "Interactive Learning",
      status: "Available",
      badgeVariant: "default" as const,
      description: "A digital space for students to explore curated learning materials, work through problems, and strengthen their understanding of challenging academic concepts.",
      icon: <Sparkles className="w-6 h-6 text-primary" />
    },
    {
      title: "Past Questions & Examination Prep",
      status: "Available",
      badgeVariant: "default" as const,
      description: "Discover verified past questions across university courses, departments, and standardized examinations. Practice in interactive CBT mode with instant feedback and explanations.",
      icon: <BookOpen className="w-6 h-6 text-emerald-500" />
    },
    {
      title: "Tutor Discovery & Live Sessions",
      status: "Available",
      badgeVariant: "default" as const,
      description: "Connect with verified peer tutors and educators based on subject and expertise. Tutors may offer free or paid 1-on-1 live video sessions with interactive whiteboards.",
      icon: <Users className="w-6 h-6 text-sky-500" />
    },
    {
      title: "Student-Centred Learning Hub",
      status: "Available",
      badgeVariant: "default" as const,
      description: "Flexible self-paced learning experiences designed to help students revise difficult topics, build study consistency, and approach examinations with genuine confidence.",
      icon: <Award className="w-6 h-6 text-amber-500" />
    },
    {
      title: "Live Virtual Classroom Webinars",
      status: "Available",
      badgeVariant: "default" as const,
      description: "High-definition WebRTC broadcast classrooms supporting real-time two-way audio, video, slide presentations, screen sharing, and composite meeting recordings.",
      icon: <Video className="w-6 h-6 text-purple-500" />
    },
    {
      title: "AI-Powered Adaptive Curricula",
      status: "In Development",
      badgeVariant: "secondary" as const,
      description: "Personalized revision paths driven by diagnostic performance insights, guiding students systematically through their unique academic focus areas.",
      icon: <Bot className="w-6 h-6 text-muted-foreground" />
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* ── STICKY TOP NAVIGATION ───────────────────────────────────── */}
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
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Home
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollToFounders}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hidden sm:inline-flex"
            >
              Founding Team
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-xs sm:text-sm font-semibold shadow-sm"
            >
              Go to Dashboard
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ── SECTION A: HERO SECTION ─────────────────────────────────── */}
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-border/40">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              About STEM Genius
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15]">
              Empowering Students. <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-primary via-purple-500 to-accent bg-clip-text text-transparent">
                Transforming Learning.
              </span>
            </h1>

            <p className="max-w-3xl mx-auto text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed font-normal">
              STEM Genius is building a smarter, more accessible learning experience by connecting
              students with educational resources, examination practice, and personalised academic support.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Button
                size="lg"
                onClick={() => navigate("/dashboard")}
                className="h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold shadow-lg shadow-primary/25 rounded-xl gap-2"
              >
                Explore STEM Genius
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={scrollToFounders}
                className="h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold rounded-xl border-border/80 hover:bg-secondary/70 gap-2"
              >
                <Users className="w-4 h-4 text-primary" />
                Meet Our Team
              </Button>
            </div>
          </div>
        </section>

        {/* ── SECTION B: OUR STORY ────────────────────────────────────── */}
        <section className="py-16 sm:py-24 border-b border-border/40 bg-secondary/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-3 mb-10">
              <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                Our Origin
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                The Story Behind STEM Genius
              </h2>
            </div>

            <Card className="glass-card border-border/60 p-6 sm:p-10 rounded-2xl shadow-xl space-y-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground font-semibold">STEM Genius</strong> was conceived around a simple but important idea:{" "}
                <span className="text-foreground">every student deserves access to the resources, guidance, and opportunities needed to succeed academically.</span>
              </p>
              <p>
                Students often have to search across multiple fragmented platforms for past examination questions, reliable learning materials, explanations of difficult concepts, and tutors who can help them understand challenging topics.
              </p>
              <p>
                STEM Genius aims to bring these learning opportunities together in one accessible, cohesive digital platform.
              </p>
              <p>
                Our goal is to make learning more organised, interactive, and student-centred by helping students find useful academic resources, prepare for examinations, and connect with people who can support their learning journey.
              </p>
              <p className="border-l-2 border-primary pl-4 text-foreground/90 italic bg-primary/5 py-2 rounded-r-lg">
                As the platform grows, STEM Genius aims to explore how technology, artificial intelligence, and community-driven learning can make education more accessible, equitable, and effective for all.
              </p>
            </Card>
          </div>
        </section>

        {/* ── SECTION C: MISSION, VISION & CORE VALUES ────────────────── */}
        <section className="py-16 sm:py-24 border-b border-border/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
            {/* Mission & Vision Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Mission Card */}
              <Card className="relative overflow-hidden p-8 sm:p-10 rounded-2xl border-border/60 glass-card hover:border-primary/40 transition-all shadow-lg flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Target className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Our Purpose
                  </span>
                  <h3 className="text-2xl font-bold text-foreground">
                    Our Mission
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    “To empower students with accessible educational resources, effective examination preparation tools, and opportunities for personalised learning through technology.”
                  </p>
                </div>
              </Card>

              {/* Vision Card */}
              <Card className="relative overflow-hidden p-8 sm:p-10 rounded-2xl border-border/60 glass-card hover:border-accent/40 transition-all shadow-lg flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <Eye className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-accent">
                    Our Aspiration
                  </span>
                  <h3 className="text-2xl font-bold text-foreground">
                    Our Vision
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    “To become a trusted learning platform that helps students across Africa access quality educational support and reach their academic potential.”
                  </p>
                </div>
              </Card>
            </div>

            {/* Core Values */}
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <Badge variant="outline" className="border-border/60 text-xs text-muted-foreground uppercase tracking-wider">
                  Guiding Principles
                </Badge>
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Our Core Values
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {coreValues.map((val) => (
                  <Card key={val.title} className="p-5 rounded-xl border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-background border border-border/40">
                        {val.icon}
                      </div>
                      <h4 className="font-bold text-sm text-foreground">
                        {val.title}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {val.description}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION D: WHAT WE ARE BUILDING ─────────────────────────── */}
        <section className="py-16 sm:py-24 border-b border-border/40 bg-secondary/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                Platform Architecture
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                What We Are Building
              </h2>
              <p className="text-sm text-muted-foreground">
                An integrated educational suite designed for real student workflows, examination demands, and collaborative support.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((item) => (
                <Card
                  key={item.title}
                  className="p-6 rounded-2xl glass-card border-border/60 hover:border-primary/40 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                        {item.icon}
                      </div>
                      <Badge
                        variant={item.badgeVariant}
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          item.status === "Available"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-secondary text-muted-foreground border border-border/60"
                        }`}
                      >
                        {item.status}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-base text-foreground">
                      {item.title}
                    </h3>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION E: MEET THE FOUNDERS ────────────────────────────── */}
        <section id="founders" className="py-16 sm:py-24 border-b border-border/40 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                Leadership
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                Meet the Founders
              </h2>
              <p className="text-sm text-muted-foreground">
                The multidisciplinary team bringing medical perspective, software engineering, and product design together to transform STEM education.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* ── FOUNDER 1: TORIOLA TIMILEHIN PAUL ── */}
              <Card className="glass-card border-border/70 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                <div className="space-y-6">
                  {/* Photo & Role Header */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                    <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 rounded-2xl overflow-hidden border-2 border-primary/40 shadow-xl bg-slate-900">
                      <img
                        src={founderImg}
                        alt="Toriola Timilehin Paul - Founder of STEM Genius"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30 text-[11px] font-semibold uppercase tracking-wider">
                        Founder, STEM Genius
                      </Badge>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                        Toriola Timilehin Paul
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground">
                        Medical Student (MBBS) • Software Developer • Educator
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1 justify-center sm:justify-start">
                        <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
                          <Stethoscope className="w-3 h-3" /> LASU MBBS
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md font-medium">
                          <Code className="w-3 h-3" /> Full-Stack Dev
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Biography */}
                  <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed pt-2 border-t border-border/40">
                    <p>
                      <strong className="text-foreground">Toriola Timilehin Paul</strong> is a medical student at Lagos State University pursuing a Bachelor of Medicine and Bachelor of Surgery (MBBS). He is passionate about software development, educational technology, and using technology to solve practical problems.
                    </p>
                    <p>
                      His journey combines medicine, technology, and education. Having developed software skills before entering medical school, he brings a multidisciplinary perspective to building digital products that are useful, accessible, and centred on real user needs.
                    </p>
                    <p>
                      His technical experience spans frontend and full-stack development, with exposure to JavaScript, React, Next.js, Vue, Node.js, MongoDB, Python, and REST APIs, alongside explorations in artificial intelligence and machine learning. His professional background includes technology training at GoMyCode and frontend engineering experience in the insurtech sector with PaddyCover.
                    </p>
                    <p>
                      Beyond development, he is actively involved in student learning. Through his role as an academic coordinator in a medical-student fellowship, he has contributed to tutorials, learning resources, and revision initiatives—strengthening his conviction that accessible educational support makes a lasting difference.
                    </p>
                  </div>

                  {/* Areas of Expertise */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Areas of Expertise & Contribution
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Software & Web Development",
                        "Frontend & Full-Stack Engineering",
                        "Educational Technology",
                        "Technical Problem-Solving",
                        "Student Learning & Tutorials",
                        "AI-Powered Digital Solutions"
                      ].map((item) => (
                        <span
                          key={item}
                          className="text-[11px] bg-secondary/80 text-foreground px-2.5 py-1 rounded-lg border border-border/50"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Project Role:</span> Platform vision, full-stack architecture, technical problem-solving, and product direction.
                </div>
              </Card>

              {/* ── FOUNDER 2: KAFAYAT ADENEYE ── */}
              <Card className="glass-card border-border/70 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                <div className="space-y-6">
                  {/* Photo & Role Header */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                    <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 rounded-2xl overflow-hidden border-2 border-accent/40 shadow-xl bg-slate-900">
                      <img
                        src={cofounderImg}
                        alt="Kafayat Adeneye - Co-founder of STEM Genius"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <Badge className="bg-accent/20 text-accent hover:bg-accent/30 border-accent/30 text-[11px] font-semibold uppercase tracking-wider">
                        Co-founder
                      </Badge>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                        Kafayat Adeneye
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground">
                        Product Designer & AI Automator
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1 justify-center sm:justify-start">
                        <span className="inline-flex items-center gap-1 text-[11px] text-accent bg-accent/10 px-2 py-0.5 rounded-md font-medium">
                          <Palette className="w-3 h-3" /> Product & UX Design
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-medium">
                          BSc Physiology Undergraduate
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Biography */}
                  <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed pt-2 border-t border-border/40">
                    <p>
                      <strong className="text-foreground">Kafayat Adeneye</strong> is a co-founder of STEM Genius, contributing a product-focused perspective to the team's mission of making learning more accessible, engaging, and effective.
                    </p>
                    <p>
                      As an undergraduate student studying BSc Physiology in the Faculty of Basic Medical Sciences and a Product Designer & AI Automator, she contributes to shaping the digital experience of STEM Genius and helping translate ideas into useful, intuitive product experiences.
                    </p>
                    <p>
                      Her role centres on product design and AI automation. Depending on project requirements, her responsibilities include user-interface design, user-experience planning, user journey mapping, workflow design, and identifying opportunities to simplify processes through automation.
                    </p>
                    <p>
                      Her contribution complements the technical development and product vision of STEM Genius, ensuring that the platform is consistently designed around students' needs. She shares the team's ambition to use technology to improve educational access and empower students to reach their academic potential.
                    </p>
                  </div>

                  {/* Areas of Contribution */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-accent" />
                      Areas of Contribution
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Product Design",
                        "User-Interface (UI) Design",
                        "User-Experience (UX) Planning",
                        "Product Planning & Feature Organization",
                        "AI Automation & Workflows",
                        "Student Experience Optimization"
                      ].map((item) => (
                        <span
                          key={item}
                          className="text-[11px] bg-secondary/80 text-foreground px-2.5 py-1 rounded-lg border border-border/50"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Project Role:</span> UI/UX experience design, feature organization, workflow mapping, and AI automation.
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ── SECTION F: FOUNDER'S NOTE ───────────────────────────────── */}
        <section className="py-16 sm:py-24 border-b border-border/40 bg-gradient-to-b from-secondary/30 via-background to-secondary/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="relative overflow-hidden p-8 sm:p-12 rounded-3xl border-border/80 glass-card shadow-2xl space-y-6">
              <Quote className="w-12 h-12 text-primary/30 absolute top-6 right-6 pointer-events-none" />

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
                Founder's Message
              </div>

              <div className="space-y-4 text-sm sm:text-base md:text-lg text-foreground/90 leading-relaxed font-serif italic">
                <p>
                  “STEM Genius is more than a platform to me; it represents an opportunity to use technology to make learning easier and more accessible for students.
                </p>
                <p>
                  As a student myself, I understand the importance of having the right resources, guidance, and support when preparing for examinations and navigating academic life.
                </p>
                <p>
                  I want STEM Genius to grow into a platform where students can find what they need to learn, practise, connect, and improve.
                </p>
                <p>
                  We are building with a clear purpose: to help students discover their potential and approach their academic journeys with greater confidence.”
                </p>
              </div>

              <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-foreground not-italic font-sans">
                    Toriola Timilehin Paul
                  </h4>
                  <p className="text-xs text-muted-foreground not-italic font-sans">
                    Founder, STEM Genius
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary not-italic font-sans font-bold text-xs">
                  TP
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* ── SECTION G: OUR FUTURE ───────────────────────────────────── */}
        <section className="py-16 sm:py-24 border-b border-border/40 text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <Badge variant="outline" className="border-primary/30 text-primary text-xs uppercase tracking-wider">
              Looking Forward
            </Badge>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Building the Future of Learning, Together
            </h2>

            <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <p>
                We believe the future of education should be more accessible, collaborative, and responsive to the needs of individual students.
              </p>
              <p>
                STEM Genius is committed to continuously improving the learning experience through useful educational resources, student-focused design, and thoughtful applications of technology.
              </p>
              <p>
                We are building step by step, learning from users, and working towards a future where more students can access the support they need to succeed.
              </p>
            </div>

            <div className="pt-4">
              <Button
                size="lg"
                onClick={() => navigate("/dashboard")}
                className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/25 rounded-xl gap-2"
              >
                Start Learning
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── SECTION H: FOOTER ───────────────────────────────────────── */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-card border-t border-border/60">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="font-extrabold text-base text-foreground">STEM Genius</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Empowering students with accessible educational resources, interactive CBT examination practice, and personalised academic support.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground mb-3">
                Learning Platform
              </h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <Link to="/past-questions" className="hover:text-primary transition-colors">
                    Past Questions Hub
                  </Link>
                </li>
                <li>
                  <Link to="/tutors" className="hover:text-primary transition-colors">
                    Tutor Marketplace
                  </Link>
                </li>
                <li>
                  <Link to="/virtual-classes" className="hover:text-primary transition-colors">
                    Live Webinars & Classes
                  </Link>
                </li>
                <li>
                  <Link to="/stem-challenge-arena" className="hover:text-primary transition-colors">
                    Challenge Arena
                  </Link>
                </li>
              </ul>
            </div>

            {/* Organization */}
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground mb-3">
                Company
              </h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <Link to="/about" className="text-primary font-medium hover:underline">
                    About Us
                  </Link>
                </li>
                <li>
                  <a href="#founders" onClick={scrollToFounders} className="hover:text-primary transition-colors">
                    Founding Team
                  </a>
                </li>
                <li>
                  <Link to="/dashboard" className="hover:text-primary transition-colors">
                    Student Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support & Legal */}
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground mb-3">
                Student Support
              </h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <Link to="/auth" className="hover:text-primary transition-colors">
                    Sign In / Register
                  </Link>
                </li>
                <li>
                  <span className="text-muted-foreground/60">Help & Feedback Available In-App</span>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="hover:text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} STEM Genius. All rights reserved.</p>
            <p className="text-[11px] text-muted-foreground/80">
              Built with purpose for students everywhere.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

