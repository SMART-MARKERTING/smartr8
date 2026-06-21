import { ExternalLink } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";

interface Project {
  title: string;
  href: string;
  image?: string;
  summary: string;
  tags: string[];
}

const projects: Project[] = [
  {
    title: "SMARTR8 Mortgage Funnel",
    href: "https://smartr8.com",
    image: "/og-image.png",
    summary: "A conversion-focused mortgage funnel with product routing, worksheet flows, tracking, and lead delivery.",
    tags: ["React", "Cloudflare Pages", "Lead capture"],
  },
  {
    title: "Quick Quote",
    href: "https://quote.smartr8.com",
    image: "/opengraph.jpg",
    summary: "A streamlined quote entry point for borrowers who want a faster path into a mortgage conversation.",
    tags: ["Mortgage tools", "UX", "CRM flow"],
  },
  {
    title: "SMARTR8 Texting",
    href: "https://github.com/SMART-MARKERTING/Smartr8-texting",
    summary: "A texting and follow-up system for keeping mortgage leads organized after the first conversion.",
    tags: ["Messaging", "Automation", "Operations"],
  },
];

function ProjectImage({ project }: { project: Project }) {
  if (project.image) {
    return (
      <img
        src={project.image}
        alt={`${project.title} preview`}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className="h-full w-full bg-[#13485A] text-white flex items-center justify-center">
      <span className="text-4xl font-bold">SM</span>
    </div>
  );
}

export default function Projects() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="Projects | Mykoal DeShazo"
        description="A small collection of sites, funnels, and tools built by Mykoal DeShazo."
        canonical="/projects"
      />
      <Header />

      <main className="flex-1">
        <section className="container mx-auto max-w-5xl px-4 py-14 md:py-20">
          <div className="max-w-2xl mb-10">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary leading-tight">
              Projects built around practical customer journeys.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              A short look at sites and systems I have built for lead capture, follow-up, and borrower education.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {projects.map((project) => (
              <a
                key={project.title}
                href={project.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-lg border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <ProjectImage project={project} />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-primary leading-snug">{project.title}</h2>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{project.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground bg-background"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
