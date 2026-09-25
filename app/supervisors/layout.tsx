import VkrGate from "@/components/layout/VkrGate";

// A1: раздел «Платформы ВКР» закрыт студентам закрытого потока
export default function Layout({ children }: { children: React.ReactNode }) {
  return <VkrGate>{children}</VkrGate>;
}
