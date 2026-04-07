import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Package, Search, Send, Upload, Loader2 } from "lucide-react";
import ComodatoImportTab from "@/modules/ixc/components/ComodatoImportTab";
import ComodatoConsultaTab from "@/modules/ixc/components/ComodatoConsultaTab";
import ComodatoLancarTab from "@/modules/ixc/components/ComodatoLancarTab";
import { usePageSEO } from "@/hooks/usePageSEO";

export default function ComodatoPage() {
  usePageSEO("/comodato");
  const navigate = useNavigate();
  const { session, loadingSession, canAccess } = useAuth();
  const [activeTab, setActiveTab] = useState<"importar" | "consultar" | "lancar">("importar");

  useEffect(() => {
    if (!loadingSession && !session) { navigate("/login"); return; }
    if (!loadingSession && session && !canAccess("comodato")) { navigate("/"); return; }
  }, [loadingSession, session, canAccess, navigate]);

  if (loadingSession || !session) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--task-purple))]" />
      </div>
    );
  }

  const tabs = [
    { key: "importar" as const, label: "Importar TXT", icon: Upload },
    { key: "consultar" as const, label: "Consultar", icon: Search },
    { key: "lancar" as const, label: "Lançar Manual", icon: Send },
  ];

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1900px] space-y-5 p-4 sm:p-5 md:p-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] shadow-lg shadow-[hsl(262_83%_58%/0.25)]">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--task-text))]">Comodato</h1>
              <p className="text-sm text-[hsl(var(--task-text-muted))]">Importe TXT, consulte e lance equipamentos em comodato via IXC.</p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl bg-[hsl(var(--task-surface))] p-1.5 border border-[hsl(var(--task-border))]">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? "bg-[hsl(var(--task-purple)/0.15)] text-[hsl(var(--task-purple))]"
                  : "text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))]"
              }`}>
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "importar" && <ComodatoImportTab auditUser={session.email} />}
        {activeTab === "consultar" && <ComodatoConsultaTab auditUser={session.email} />}
        {activeTab === "lancar" && <ComodatoLancarTab auditUser={session.email} />}
      </div>
    </div>
  );
}
