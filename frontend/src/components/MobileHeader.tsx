import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

export default function MobileHeader({
}: {}) {
  const { isMobile, toggleSidebar } = useSidebar();

  if (!isMobile) return null;

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-3 py-2.5"
      style={{
        background: "linear-gradient(180deg, hsl(234 50% 12%), hsl(234 45% 10%))",
        borderBottom: "1px solid hsl(222 25% 14%)",
        boxShadow: "0 4px 20px -4px rgba(0,0,0,0.5)",
      }}
    >
      <button
        onClick={toggleSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white active:bg-white/[0.12]"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <img
        src="/resouce/ISP-Consulte-v3-branco.png"
        alt="ISP Consulte"
        className="h-7 w-auto object-contain"
      />
      <div className="h-10 w-10" />
    </header>
  );
}
