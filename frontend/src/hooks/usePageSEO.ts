import { useEffect } from "react";

const BASE_TITLE = "ISP Consulte";

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: `Dashboard | ${BASE_TITLE}`,
    description: "Painel principal do ISP Consulte — visão geral de clientes, tarefas e indicadores.",
  },
  "/tarefas": {
    title: `Tarefas | ${BASE_TITLE}`,
    description: "Gerencie e acompanhe todas as tarefas dos projetos no ISP Consulte.",
  },
  "/analiticas": {
    title: `Analíticas | ${BASE_TITLE}`,
    description: "Relatórios de desempenho, horas e produtividade dos projetos.",
  },
  "/usuarios": {
    title: `Usuários | ${BASE_TITLE}`,
    description: "Administração de usuários, perfis e permissões de acesso.",
  },
  "/integracoes": {
    title: `Integrações | ${BASE_TITLE}`,
    description: "Conecte e gerencie integrações com sistemas externos.",
  },
  "/comodato": {
    title: `Comodato | ${BASE_TITLE}`,
    description: "Consulta e gerenciamento de equipamentos em comodato.",
  },
  "/suporte": {
    title: `Suporte | ${BASE_TITLE}`,
    description: "Central de suporte e ajuda do ISP Consulte.",
  },
  "/login": {
    title: `Login | ${BASE_TITLE}`,
    description: "Acesse sua conta no ISP Consulte.",
  },
};

/**
 * Updates document title and meta description based on the current route.
 * Call once per page component.
 */
export function usePageSEO(path?: string) {
  useEffect(() => {
    const route = path ?? window.location.pathname;
    const meta = PAGE_META[route] ?? {
      title: BASE_TITLE,
      description: "ISP Consulte — plataforma de gestão para provedores de internet.",
    };

    document.title = meta.title;

    let descTag = document.querySelector('meta[name="description"]');
    if (descTag) {
      descTag.setAttribute("content", meta.description);
    } else {
      descTag = document.createElement("meta");
      descTag.setAttribute("name", "description");
      descTag.setAttribute("content", meta.description);
      document.head.appendChild(descTag);
    }

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", meta.title);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", meta.description);
  }, [path]);
}
