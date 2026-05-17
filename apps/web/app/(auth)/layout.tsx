export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00djJoLTJ2LTJoMnptLTQgOHYyaC0ydi0yaDJ6bTAgNHYyaC0ydi0yaDJ6bTAtOHYyaC0ydi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm text-white font-bold text-xl shadow-lg">
              ST
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                StokTakip
              </h1>
              <p className="text-white/80 text-sm font-medium uppercase tracking-widest">
                PRO
              </p>
            </div>
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Stoklarınızı
            <br />
            <span className="text-white/90">Akıllıca</span> Yönetin
          </h2>
          <p className="text-white/70 text-lg leading-relaxed max-w-md">
            Bulut tabanlı, barkod destekli profesyonel stok yönetim sistemi.
            Her yerden, her cihazdan erişin.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { value: "99.9%", label: "Uptime" },
              { value: "256-bit", label: "Şifreleme" },
              { value: "∞", label: "Ürün" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-2xl font-bold text-white">{item.value}</p>
                <p className="text-xs text-white/60 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
