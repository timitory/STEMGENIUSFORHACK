import { Crown, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PremiumBannerProps {
  isPremium: boolean;
  onTogglePremium: () => void;
}

export function PremiumBanner({ isPremium, onTogglePremium }: PremiumBannerProps) {
  return (
    <div className="relative overflow-hidden border-t border-accent/20">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-accent/10 to-primary/5" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent" />
      <div className="absolute top-0 left-1/4 w-48 h-24 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-36 h-20 bg-primary/10 rounded-full blur-3xl" />
      
      <div className="relative max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0 border border-accent/20 glow-accent">
            <Crown className="w-6 h-6 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <h3 className="text-sm font-extrabold text-foreground">
                {isPremium ? "Premium Active" : "Upgrade to Premium"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPremium 
                ? "Unlimited access to all features and exclusive content"
                : "Unlock all features, premium content, and exclusive challenges"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xl font-extrabold gradient-text-accent">₦2,000</p>
            <p className="text-[10px] text-muted-foreground -mt-0.5">per month</p>
          </div>
          <Button 
            size="sm"
            onClick={onTogglePremium}
            className="h-9 px-5 text-xs font-bold bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5 hover:scale-105 transition-all hover:shadow-[0_0_24px_-4px_hsl(var(--accent)/0.5)]"
          >
            {isPremium ? "Manage" : "Upgrade"}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
