import { FaBook, FaHistory, FaHome, FaPlusCircle } from "react-icons/fa";
import { MdAutoAwesome } from "react-icons/md";

/** Menu lateral único do gerente (todas as páginas do fluxo manager). */
export const MANAGER_MENU_ITEMS = [
  { key: "overview", to: "/manager", label: "Visão Geral", icon: <FaHome /> },
  { key: "history", to: "/manager?tab=history", label: "Histórico", icon: <FaHistory /> },
  { key: "catalog", to: "/manager?tab=catalog", label: "Catálogo", icon: <FaBook /> },
  { key: "new-purchase", to: "/manager/new-purchase", label: "Registrar compra", icon: <FaPlusCircle /> },
  { key: "purchase-ai", to: "/manager/new-purchase/ai", label: "Compra com IA", icon: <MdAutoAwesome /> }
];

export function buildManagerSidebarLinks(navigate, onSelectKey) {
  return MANAGER_MENU_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    onClick: () => {
      navigate(item.to);
      if (onSelectKey) onSelectKey(item.key);
    }
  }));
}
