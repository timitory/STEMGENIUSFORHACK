import { useState } from "react";
import heroLandingImg from "@/assets/hero-landing.jpg";
import founderImg from "@/assets/founder-toriola-paul.png";
import cofounderImg from "@/assets/cofounder-kafayat-adeneye.jpg";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  GraduationCap, Brain, Mic, Lightbulb, Atom, BookOpen, Video, 
  FileText, Users, Trophy, Star, ArrowRight, CheckCircle2, Play,
  Sparkles, Globe, Award, TrendingUp, ChevronRight, Menu, X
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: <Brain className="w-8 h-8" />,
      title: "AI Homework Helper",
      description: "Snap photos of problems and get instant step-by-step solutions in any language",
      route: "/ai-homework-helper"
    },
    {
      icon: <Mic className="w-8 h-8" />,
      title: "Voice STEM Tutor",
      description: "Ask questions and receive voice explanations in multiple languages",
      route: "/voice-stem-tutor"
    },
    {
      icon: <Lightbulb className="w-8 h-8" />,
      title: "STEM Challenge Arena",
      description: "Compete in quizzes, win prizes, and climb the leaderboard",
      route: "/stem-challenge-arena"
    },
    {
      icon: <Atom className="w-8 h-8" />,
      title: "AR STEM Labs",
      description: "Experience virtual 3D experiments in physics, chemistry, and biology",
      route: "/ar-stem-labs"
    },
    {
      icon: <Video className="w-8 h-8" />,
      title: "STEM Reels",
      description: "Create and share educational videos, go live with your audience",
      route: "/stem-reels"
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: "STEM Marketplace",
      description: "Buy and sell educational content, books, and materials",
      route: "/marketplace"
    }
  ];

  const testimonials = [
    {
      name: "Adaeze Okonkwo",
      role: "Medical Student, UNILAG",
      image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=100&h=100&fit=crop&crop=face",
      text: "STEM Genius transformed how I study. The AI tutor explains complex biology concepts in ways I actually understand!"
    },
    {
      name: "Emeka Nwosu",
      role: "Engineering Student, OAU",
      image: "https://plus.unsplash.com/premium_photo-1661963502826-a0ccb55196fd?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
      text: "The challenge arena keeps me motivated. I've improved my math scores by 40% in just 2 months!"
    },
    {
      name: "Fatima Ibrahim",
      role: "High School Teacher, Kano",
      image: "https://plus.unsplash.com/premium_photo-1681494086824-7200170f1353?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
      text: "I use STEM Genius to create quizzes for my students. The AI-generated questions save me hours of work!"
    }
  ];

  const stats = [
    { value: "50K+", label: "Active Students" },
    { value: "1M+", label: "Questions Solved" },
    { value: "500+", label: "Schools" },
    { value: "98%", label: "Satisfaction" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0" onClick={() => navigate("/")}>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <span className="text-base sm:text-xl font-bold text-foreground">STEM Genius</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/about")} className="text-foreground hover:text-primary text-sm font-semibold">
                About Us
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-sm">
                Sign In
              </Button>
              <Button size="sm" onClick={() => navigate("/auth")} className="text-sm font-semibold px-4">
                Get Started
              </Button>
            </div>

            {/* Mobile Actions: Get Started + Hamburger */}
            <div className="flex sm:hidden items-center gap-2">
              <Button size="sm" onClick={() => navigate("/auth")} className="text-xs font-semibold px-3 h-8">
                Get Started
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="h-8 w-8 text-foreground"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Slide-Over Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <div 
              className="absolute inset-0 bg-background/90 backdrop-blur-md" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            <div className="relative p-5 space-y-5 bg-card border-b border-border shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-base text-foreground">STEM Genius</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button 
                  variant="ghost" 
                  onClick={() => { navigate("/about"); setMobileMenuOpen(false); }} 
                  className="w-full justify-start text-sm font-semibold h-10 px-3"
                >
                  <Sparkles className="w-4 h-4 mr-2.5 text-primary" />
                  About Us &amp; Leadership
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }} 
                  className="w-full justify-start text-sm font-semibold h-10 px-3"
                >
                  <GraduationCap className="w-4 h-4 mr-2.5 text-accent" />
                  Sign In to Account
                </Button>
                <Button 
                  onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }} 
                  className="w-full text-sm font-bold h-10 mt-2 bg-primary text-primary-foreground"
                >
                  Create Free Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroLandingImg} alt="STEM Learning" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/80 to-background/60" />
        </div>
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl hidden md:block" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl hidden md:block" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2">
                <Sparkles className="w-4 h-4 mr-2" />
                AI-Powered Learning Platform
              </Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Master STEM with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  AI Superpowers
                </span>
              </h1>
              <p className="text-base sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
                Join thousands of African students excelling in Science, Technology, Engineering, and Math with personalized AI tutoring, interactive labs, and a vibrant learning community.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-3.5 h-auto font-semibold" onClick={() => navigate("/auth")}>
                  Start Learning Free
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-3.5 h-auto">
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Watch Demo
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <img
                      key={i}
                      src={`https://images.unsplash.com/photo-${1500000000000 + i * 10000000}?w=40&h=40&fit=crop&crop=face`}
                      alt=""
                      className="w-10 h-10 rounded-full border-2 border-background object-cover"
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`;
                      }}
                    />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">Loved by 50,000+ students</p>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border">
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop"
                  alt="Students learning"
                  className="w-full h-64 sm:h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <Card className="p-4 bg-card/90 backdrop-blur">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">AI Tutor Active</p>
                        <p className="text-sm text-muted-foreground">Solving: Quadratic Equations</p>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
              
              {/* Floating Cards */}
              <Card className="absolute -top-4 -right-4 p-3 bg-card shadow-lg animate-float hidden md:flex">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-accent" />
                  <span className="text-sm font-medium">#1 in Physics</span>
                </div>
              </Card>
              <Card className="absolute -bottom-4 -left-4 p-3 bg-card shadow-lg animate-float hidden md:flex" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">Quiz Passed!</span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-primary">{stat.value}</p>
                <p className="text-muted-foreground mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4">Features</Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Everything You Need to Excel
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From AI-powered tutoring to interactive experiments, we've got all the tools you need
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card 
                key={i} 
                className="p-6 hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group"
                onClick={() => navigate(feature.route)}
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
                <div className="flex items-center text-primary mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-sm font-medium">Try it now</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AR Labs Showcase */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="grid grid-cols-2 gap-4">
                <img
                  src="https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=300&fit=crop"
                  alt="Science experiment"
                  className="rounded-xl shadow-lg"
                />
                <img
                  src="https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400&h=300&fit=crop"
                  alt="Biology lab"
                  className="rounded-xl shadow-lg mt-8"
                />
                <img
                  src="https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=400&h=300&fit=crop"
                  alt="Chemistry"
                  className="rounded-xl shadow-lg"
                />
                <img
                  src="https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400&h=300&fit=crop"
                  alt="Physics"
                  className="rounded-xl shadow-lg mt-8"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <Badge>Virtual Labs</Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
                Experience 3D STEM Labs
              </h2>
              <p className="text-xl text-muted-foreground">
                Conduct virtual experiments in physics, chemistry, biology, and more. Learn by doing with our interactive 3D simulations.
              </p>
              <ul className="space-y-4">
                {["Physics simulations", "Chemistry reactions", "Biology & Anatomy", "Engineering models"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" onClick={() => navigate("/auth")}>
                Try AR Labs Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      
      {/* About & Founders Preview Section */}
      <section className="py-20 px-4 bg-secondary/30 border-t border-b border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Our Mission & Leadership
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Empowering Students. Transforming Learning.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              STEM Genius was conceived around a simple but important idea: every student deserves access to the resources, guidance, and opportunities needed to succeed academically.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
            {/* Founder Card Preview */}
            <Card className="glass-card border-border/70 p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row gap-5 items-center sm:items-start text-center sm:text-left shadow-lg hover:border-primary/40 transition-all">
              <img
                src={founderImg}
                alt="Toriola Timilehin Paul"
                className="w-28 h-28 shrink-0 rounded-2xl object-cover object-top border-2 border-primary/40 shadow-md bg-slate-900"
              />
              <div className="space-y-2">
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase font-semibold">
                  Founder
                </Badge>
                <h3 className="text-xl font-bold text-foreground">Toriola Timilehin Paul</h3>
                <p className="text-xs font-medium text-muted-foreground">
                  LASU Medical Student (MBBS) • Full-Stack Developer • Educator
                </p>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  Passionate about software development, educational technology, and building digital products that make learning accessible, organised, and student-centred.
                </p>
              </div>
            </Card>

            {/* Co-founder Card Preview */}
            <Card className="glass-card border-border/70 p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row gap-5 items-center sm:items-start text-center sm:text-left shadow-lg hover:border-accent/40 transition-all">
              <img
                src={cofounderImg}
                alt="Kafayat Adeneye"
                className="w-28 h-28 shrink-0 rounded-2xl object-cover object-top border-2 border-accent/40 shadow-md bg-slate-900"
              />
              <div className="space-y-2">
                <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px] uppercase font-semibold">
                  Co-founder
                </Badge>
                <h3 className="text-xl font-bold text-foreground">Kafayat Adeneye</h3>
                <p className="text-xs font-medium text-muted-foreground">
                  Product Designer & AI Automator • BSc Physiology
                </p>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  Focuses on product design, user experience planning, workflow optimization, and leveraging automation to improve the student experience.
                </p>
              </div>
            </Card>
          </div>

          <div className="text-center">
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/about")}
              className="rounded-xl px-6 font-semibold border-primary/40 text-primary hover:bg-primary/10 gap-2 shadow-sm"
            >
              Read Our Full Story & Vision
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4">Testimonials</Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Loved by Students Across Africa
            </h2>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 md:p-12 bg-card">
              <div className="flex flex-col items-center text-center">
                <img
                  src={testimonials[activeTestimonial].image}
                  alt={testimonials[activeTestimonial].name}
                  className="w-20 h-20 rounded-full object-cover mb-6"
                />
                <p className="text-base sm:text-xl md:text-2xl text-foreground mb-4 sm:mb-6 italic leading-relaxed">
                  "{testimonials[activeTestimonial].text}"
                </p>
                <p className="font-semibold text-foreground">{testimonials[activeTestimonial].name}</p>
                <p className="text-muted-foreground">{testimonials[activeTestimonial].role}</p>
              </div>
            </Card>
            
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    i === activeTestimonial ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary to-accent text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of students already excelling with STEM Genius. Start for free today!
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-3.5 h-auto font-semibold" onClick={() => navigate("/auth")}>
              Create Free Account
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-3.5 h-auto bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">STEM Genius</span>
              </div>
              <p className="text-muted-foreground">
                Empowering African students to excel in STEM through AI-powered learning.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Features</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li>AI Homework Helper</li>
                <li>Voice STEM Tutor</li>
                <li>AR STEM Labs</li>
                <li>STEM Marketplace</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><button onClick={() => navigate("/about")} className="hover:text-primary transition-colors text-left">About Us</button></li>
                <li>Careers</li>
                <li>Blog</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
                <li>Cookie Policy</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-muted-foreground">
            <p>© 2026 STEM Genius. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
