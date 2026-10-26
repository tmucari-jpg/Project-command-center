import Link from "next/link";
import {
  Bot,
  CircleDollarSign,
  BrainCircuit,
  BookOpenCheck,
  CircleHelp,
  FlaskConical,
  HardDrive,
  LockKeyhole,
  Smartphone,
  Radar,
  Repeat2,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

const groups = [
  {
    title: "Comercial",
    description: "Capacidade transversal para todos os projectos que exigem avaliação ou execução comercial.",
    tools: [
      { href: "/monetization", label: "Comercial", description: "Backlog, pipeline, leads, oferta/preço, custos/receitas e entregáveis comerciais ligados aos projectos.", icon: CircleDollarSign },
    ],
  },
  {
    title: "IA & Automação",
    description: "Capacidades usadas pelos projectos sem obrigar o utilizador a sair do fluxo operacional.",
    tools: [
      { href: "/ai-providers", label: "IA / Providers", description: "Configuração e saúde dos providers.", icon: HardDrive },
      { href: "/bot-ia", label: "BotIA", description: "Assistência operacional dentro dos projectos.", icon: Bot },
      { href: "/agents", label: "Agentes", description: "Execuções especializadas e controladas.", icon: BrainCircuit },
      { href: "/automation", label: "Automações", description: "Execuções automáticas e aprovações.", icon: Workflow },
      { href: "/orchestrator", label: "Orquestração", description: "Regras de encaminhamento en���q�^