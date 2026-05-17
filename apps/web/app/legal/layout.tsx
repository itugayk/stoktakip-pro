import { MarketingShell } from "@/components/marketing/marketing-shell";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingShell>
      <article className="container mx-auto px-4 py-12 max-w-3xl prose prose-sm dark:prose-invert prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-p:text-muted-foreground prose-p:leading-relaxed prose-li:text-muted-foreground prose-strong:text-foreground">
        {children}
      </article>
    </MarketingShell>
  );
}
