import { Badge } from "@/components/ui/badge";
import { ArrowUpRight } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  onClick?: () => void;
}

export function FeatureCard({ title, description, icon, badge, onClick }: FeatureCardProps) {
  return (
    <div 
      className="group relative p-3 sm:p-5 rounded-xl glass-card hover:border-primary/30 cursor-pointer transition-all duration-300 hover:shadow-[0_10px_40px_-12px_hsl(271_91%_65%_/_0.2)] hover:scale-[1.02] overflow-hidden"
      onClick={onClick}
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:shadow-[0_0_24px_-4px_hsl(271_91%_65%_/_0.5)] group-hover:scale-110 flex-shrink-0">
            {icon}
          </div>
          <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground/0 group-hover:text-primary transition-all duration-300 -translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 flex-shrink-0" />
        </div>
        
        <h3 className="text-xs sm:text-sm font-bold mb-1 text-foreground group-hover:text-primary transition-colors line-clamp-2">{title}</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
        
        {badge && (
          <Badge className="mt-2 sm:mt-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 text-[9px] sm:text-[10px] font-semibold h-5 sm:h-6">
            {badge}
          </Badge>
        )}
      </div>
    </div>
  );
}
