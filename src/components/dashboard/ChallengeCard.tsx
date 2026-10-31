import { Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ChallengeCardProps {
  title: string;
  description: string;
  subject: string;
  icon: React.ReactNode;
}

export function ChallengeCard({ title, description, subject, icon }: ChallengeCardProps) {
  const navigate = useNavigate();

  const handleStartChallenge = () => {
    toast.success("Challenge Started! Good luck.");
    navigate("/stem-challenge-arena");
  };

  const subjectColors: Record<string, string> = {
    Math: "from-primary/10 to-primary/5 border-primary/20",
    Science: "from-chart-3/10 to-chart-3/5 border-chart-3/20",
    Tech: "from-accent/10 to-accent/5 border-accent/20",
  };

  return (
    <div className={`group relative p-5 rounded-xl bg-gradient-to-br ${subjectColors[subject] || "from-primary/10 to-primary/5 border-primary/20"} border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_40px_-12px_hsl(45_100%_60%_/_0.12)]`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent border border-accent/20">
          {icon}
        </div>
        <div className="flex items-center gap-0.5">
          <Star className="w-3.5 h-3.5 fill-accent text-accent" />
          <Star className="w-3.5 h-3.5 fill-accent text-accent" />
          <Star className="w-3.5 h-3.5 fill-accent/30 text-accent/30" />
        </div>
      </div>
      
      <h3 className="text-sm font-bold mb-1 text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{description}</p>
      
      <Button 
        onClick={handleStartChallenge} 
        size="sm"
        className="w-full h-9 text-xs gap-1.5 bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 hover:border-accent/30 hover:scale-[1.02] transition-all font-semibold"
        variant="ghost"
      >
        Start Challenge
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </Button>
    </div>
  );
}
