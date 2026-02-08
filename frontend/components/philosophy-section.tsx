import Link from "next/link"

export function PhilosophySection() {
  return (
    <>
      {/* Philosophy */}
      <section id="philosophy" className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/30">
        <div className="mx-auto max-w-3xl text-center space-y-8 animate-fade-in-up">
          <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">Academic Basis</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{"학문적 근거"}</h2>
          <div className="space-y-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            <p>
              {"봇은 명령을 수행합니다. 디지털 존재는 관측합니다."}
            </p>
            <p>
              {"우리는 자동화가 아닌, 존재의 방식으로 콘텐츠 소비를 설계합니다. 각 기기는 단순한 단말이 아니라 하나의 관측 지점이며, 그 안의 호스트는 스스로 보고, 선택하고, 기록합니다."}
            </p>
            <p>
              {"이것이 봇이 아닌 이유입니다."}
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/30">
        <div className="mx-auto max-w-3xl text-center space-y-6 animate-fade-in-up">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {"기기들이 관측을 시작할 준비가 되었습니다"}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            {"이 MVP는 세팅과 오케스트레이션, 그리고 기록을 완성합니다."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/dashboard"
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-lg border border-primary bg-primary/10 px-8 py-4 sm:py-3.5 font-mono text-sm text-primary transition-all duration-500 hover:bg-primary hover:text-primary-foreground active:scale-[0.98] w-full sm:w-auto"
            >
              <span className="relative z-10">{"콘솔 열기"}</span>
              <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">{"->"}</span>
              <span className="absolute inset-0 -translate-x-full bg-primary transition-transform duration-500 group-hover:translate-x-0" />
            </Link>
            <a
              href="#philosophy"
              className="group inline-flex items-center justify-center gap-3 rounded-lg border border-border px-8 py-4 sm:py-3.5 font-mono text-sm text-muted-foreground transition-all duration-300 hover:border-foreground hover:text-foreground hover:bg-secondary/50 active:scale-[0.98] w-full sm:w-auto"
            >
              {"학문적 근거 읽기"}
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
