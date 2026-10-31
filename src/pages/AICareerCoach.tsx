import { useState, useEffect } from "react";
import heroCareerCoachImg from "@/assets/hero-career-coach.jpg";
import { PageHeroBanner } from "@/components/PageHeroBanner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, GraduationCap, TrendingUp, MapPin, History, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface CareerAssessment {
  id: string;
  interests: string[] | null;
  skills: string[] | null;
  education_level: string | null;
  location: string | null;
  career_goals: string | null;
  ai_recommendations: any;
  created_at: string;
}

export default function AICareerCoach() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState("");
  const [assessmentHistory, setAssessmentHistory] = useState<CareerAssessment[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [educationLevel, setEducationLevel] = useState("");
  const [location, setLocation] = useState("");
  const [careerGoals, setCareerGoals] = useState("");

  const interestOptions = [
    "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science",
    "Engineering", "Medicine", "Data Science", "Robotics", "Environmental Science",
    "Artificial Intelligence", "Astronomy", "Biotechnology", "Nanotechnology",
    "Architecture", "Business Administration", "Accounting", "Marketing", "Economics",
    "Entrepreneurship", "Graphic Design", "UI/UX Design", "Cybersecurity", "Software Development",
    "Mobile App Development", "Web Development", "Psychology", "Sociology", "Law",
    "Political Science", "International Relations", "Public Health", "Nursing", "Pharmacy",
    "Agriculture", "Food Science", "Geology", "Statistics", "Creative Writing",
    "Journalism", "Music", "Fine Arts", "Theatre Arts"
  ];

  const skillOptions = [
    "Problem Solving", "Programming", "Critical Thinking", "Mathematics",
    "Communication", "Research", "Teamwork", "Leadership", "Creativity",
    "Data Analysis", "Project Management", "Public Speaking",
    "Time Management", "Adaptability", "Analytical Thinking", "Collaboration",
    "Decision Making", "Attention to Detail", "Technical Writing", "Coding",
    "Machine Learning", "Cybersecurity", "Design Thinking", "Negotiation",
    "Conflict Resolution", "Emotional Intelligence", "Entrepreneurial Skills",
    "Marketing Skills", "Financial Literacy", "Presentation Skills",
    "Networking", "Problem Diagnosis", "Strategic Planning", "Quality Assurance",
    "Customer Service", "Multi-tasking", "Product Design", "UX Research", "Data Visualization"
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
  };

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("career_assessments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data && !error) {
      setAssessmentHistory(data as unknown as CareerAssessment[]);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const handleGetRecommendations = async () => {
    if (selectedInterests.length === 0 || selectedSkills.length === 0 || !educationLevel) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("career-coach", {
        body: {
          interests: selectedInterests,
          skills: selectedSkills,
          educationLevel,
          location,
          careerGoals
        }
      });

      if (error) throw error;

      setRecommendations(data.recommendations);

      // Save assessment to database
      if (user) {
        await supabase.from("career_assessments").insert({
          user_id: user.id,
          interests: selectedInterests,
          skills: selectedSkills,
          education_level: educationLevel,
          location,
          career_goals: careerGoals,
          ai_recommendations: { content: data.recommendations }
        });
        fetchHistory();
      }

      toast.success("Career recommendations generated!");
    } catch (error: any) {
      console.error("Error getting recommendations:", error);
      toast.error(error.message || "Failed to get recommendations");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromHistory = (assessment: CareerAssessment) => {
    if (assessment.interests) setSelectedInterests(assessment.interests);
    if (assessment.skills) setSelectedSkills(assessment.skills);
    if (assessment.education_level) setEducationLevel(assessment.education_level);
    if (assessment.location) setLocation(assessment.location);
    if (assessment.career_goals) setCareerGoals(assessment.career_goals);
    if (assessment.ai_recommendations?.content) {
      setRecommendations(assessment.ai_recommendations.content);
    }
    toast.success("Assessment loaded");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <PageHeroBanner image={heroCareerCoachImg} title="AI Career Coach" subtitle="Get personalized STEM career guidance powered by AI" badge="AI Guidance" />

        <div className="mt-6">

        <Tabs defaultValue="new" className="space-y-6">
          <TabsList>
            <TabsTrigger value="new">
              <Sparkles className="w-4 h-4 mr-2" />
              New Assessment
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              History ({assessmentHistory.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Your Profile
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Select Your Interests *</Label>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {interestOptions.map((interest) => (
                          <Badge
                            key={interest}
                            variant={selectedInterests.includes(interest) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleInterest(interest)}
                          >
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Select Your Skills *</Label>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {skillOptions.map((skill) => (
                          <Badge
                            key={skill}
                            variant={selectedSkills.includes(skill) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleSkill(skill)}
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="education">Education Level *</Label>
                      <Select value={educationLevel} onValueChange={setEducationLevel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select education level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="secondary">Secondary School</SelectItem>
                          <SelectItem value="undergraduate">Undergraduate</SelectItem>
                          <SelectItem value="graduate">Graduate/Postgraduate</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="location">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Location
                      </Label>
                      <Input
                        id="location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g., Lagos, Nigeria"
                      />
                    </div>

                    <div>
                      <Label htmlFor="goals">Career Goals</Label>
                      <Textarea
                        id="goals"
                        value={careerGoals}
                        onChange={(e) => setCareerGoals(e.target.value)}
                        placeholder="What are your career aspirations?"
                        rows={4}
                      />
                    </div>

                    <Button
                      onClick={handleGetRecommendations}
                      disabled={isLoading}
                      className="w-full"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Analyzing Your Profile...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-5 w-5" />
                          Get Career Recommendations
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>

              <div>
                <Card className="p-6 h-full">
                  <h2 className="text-xl font-semibold mb-4">AI Recommendations</h2>
                  {recommendations ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert overflow-y-auto max-h-60 sm:max-h-[600px]">
                      <ReactMarkdown>{recommendations}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p>Fill in your profile and click "Get Career Recommendations" to receive personalized guidance</p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Assessment History
              </h2>
              
              {assessmentHistory.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>No previous assessments found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assessmentHistory.map((assessment) => (
                    <div key={assessment.id} className="border border-border rounded-lg overflow-hidden">
                      <div 
                        className="p-4 bg-muted/50 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedHistory(expandedHistory === assessment.id ? null : assessment.id)}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{assessment.education_level || "N/A"}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(assessment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {assessment.interests?.slice(0, 3).map((interest) => (
                              <Badge key={interest} variant="secondary" className="text-xs">{interest}</Badge>
                            ))}
                            {assessment.interests && assessment.interests.length > 3 && (
                              <Badge variant="secondary" className="text-xs">+{assessment.interests.length - 3}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); loadFromHistory(assessment); }}>
                            Load
                          </Button>
                          {expandedHistory === assessment.id ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                      
                      {expandedHistory === assessment.id && (
                        <div className="p-4 border-t border-border">
                          {assessment.career_goals && (
                            <div className="mb-4">
                              <p className="text-sm font-medium mb-1">Career Goals:</p>
                              <p className="text-sm text-muted-foreground">{assessment.career_goals}</p>
                            </div>
                          )}
                          {assessment.ai_recommendations?.content && (
                            <div>
                              <p className="text-sm font-medium mb-2">AI Recommendations:</p>
                              <div className="prose prose-sm max-w-none dark:prose-invert max-h-60 overflow-y-auto bg-muted/30 p-3 rounded-lg">
                                <ReactMarkdown>{assessment.ai_recommendations.content}</ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}