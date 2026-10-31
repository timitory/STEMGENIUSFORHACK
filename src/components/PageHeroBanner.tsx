interface PageHeroBannerProps {
  image: string;
  title: string;
  subtitle?: string;
  badge?: string;
  align?: "left" | "center";
  height?: string;
}

export function PageHeroBanner({ image, title, subtitle, badge, align = "left", height = "h-36 sm:h-48" }: PageHeroBannerProps) {
  return (
    <div className={`relative rounded-2xl overflow-hidden ${height}`}>
      <img src={image} alt={title} className="w-full h-full object-cover" />
      <div className={`absolute inset-0 ${align === "center" ? "bg-gradient-to-t from-background via-background/70 to-background/30" : "bg-gradient-to-r from-background/95 via-background/70 to-transparent"} flex items-end ${align === "center" ? "justify-center text-center" : ""}`}>
        <div className={`p-5 sm:p-6 ${align === "center" ? "pb-5" : ""}`}>
          {badge && (
            <span className="inline-flex items-center gap-1.5 bg-primary/20 backdrop-blur-sm text-primary text-xs font-medium px-3 py-1 rounded-full mb-2">
              {badge}
            </span>
          )}
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-lg">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
