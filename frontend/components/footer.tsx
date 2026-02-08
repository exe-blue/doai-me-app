import { Github } from "lucide-react"

const footerLinks = [
  { label: "콘솔", href: "/dashboard" },
  { label: "기술적 구현", href: "/#tech" },
  { label: "학문적 근거", href: "/#philosophy" },
  { label: "GitHub", href: "https://github.com", external: true },
]

export function Footer() {
  return (
    <footer className="border-t border-border/30 px-4 sm:px-6 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label === "GitHub" ? (
                  <span className="flex items-center gap-1.5">
                    <Github className="h-3.5 w-3.5" />
                    {link.label}
                  </span>
                ) : (
                  link.label
                )}
              </a>
            ))}
          </div>

          <p className="font-mono text-xs text-muted-foreground/60">
            {"© 2026 DoAi.Me"}
          </p>
        </div>
      </div>
    </footer>
  )
}
