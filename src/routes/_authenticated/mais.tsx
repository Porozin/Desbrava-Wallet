import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Download,
  LogOut,
  Smartphone,
  ShieldCheck,
  Printer,
  CloudDownload,
  Lock,
  Plus,
  CheckCircle2,
  Clock,
  Users2,
  UserCheck,
  FileText,
  Globe,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/m3/AppShell";
import { MetricCard } from "@/components/m3/parts";
import { MODULE_LABEL, CASH_BOX_LABEL, CashBoxId, brl, summarize } from "@/lib/finance";
import {
  ROLE_LABEL,
  Role,
  useMe,
  useTransactions,
  useDividas,
  addDivida,
  registrarPagamentoParcial,
  agendarExclusaoDivida,
  deleteDivida,
  type Divida,
  updateDividaStatus,
  useIsAdminOrDiretor,
  useIsAdmin,
  useIsConselheiro,
  useAllUsers,
  updateUserRole,
} from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { generatePrintReport } from "@/lib/printReport";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ReportsCenterDrawer } from "@/components/m3/ReportsCenterDrawer";
import { WipeDataDrawer } from "@/components/m3/WipeDataDrawer";

export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({
    meta: [
      { title: "GDACaixa 2027 — Perfil e Ajustes" },
      { name: "description", content: "Relatórios, controle interno, hierarquia de usuários e backup." },
      { property: "og:title", content: "GDACaixa 2027 — Perfil e Ajustes" },
      { property: "og:description", content: "Relatórios, controle interno, hierarquia de usuários e backup." },
    ],
  }),
  component: Mais,
});

function Mais() {
  const all = useTransactions();
  const { data: dividas = [] } = useDividas();
  const { data: me } = useMe();
  const { data: allUsers = [] } = useAllUsers();
  const isAdminOrDiretor = useIsAdminOrDiretor();
  const isAdmin = useIsAdmin();
  const isConselheiro = useIsConselheiro();
  const canManageAnyUser = isAdmin || isAdminOrDiretor || isConselheiro;

  const qc = useQueryClient();
  const navigate = useNavigate();

  const [dividaDrawerOpen, setDividaDrawerOpen] = useState(false);
  const [pagamentoDrawer, setPagamentoDrawer] = useState<Divida | null>(null);
  const [pagamentoValor, setPagamentoValor] = useState("");
  const [pagamentoOpcaoDrawer, setPagamentoOpcaoDrawer] = useState<Divida | null>(null);
  const [usersDrawerOpen, setUsersDrawerOpen] = useState(false);
  const [reportsDrawerOpen, setReportsDrawerOpen] = useState(false);
  const [wipeDrawerOpen, setWipeDrawerOpen] = useState(false);
  const [backupWebhook, setBackupWebhook] = useState(
    () => localStorage.getItem("gda_backup_webhook") || ""
  );

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // 1. Exportação em Planilha CSV Completa
  function exportCsv() {
    const rows = [
      ["Data", "Caixa", "Módulo", "Tipo", "Categoria", "Descrição", "Vendedor", "Forma Pagamento", "Situação", "Valor"],
      ...all.map((t) => [
        t.date,
        CASH_BOX_LABEL[t.cash_box_id || (t.module === "clube" ? "geral" : (t.module as CashBoxId))] || t.module,
        MODULE_LABEL[t.module],
        t.kind,
        t.category,
        t.description,
        t.seller ?? "",
        t.payment_method ?? "dinheiro",
        t.status ?? "confirmado",
        t.amount.toFixed(2).replace(".", ","),
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
        .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `gdacaixa-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success("Planilha CSV exportada com sucesso!");
  }

  // 2. Exportação de Backup JSON
  function exportJson() {
    const backupData = {
      versao: "GDA Caixa 2027",
      data_backup: new Date().toISOString(),
      gerado_por: me?.name,
      transacoes: all,
      dividas,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([jsonStr], { type: "application/json;charset=utf-8" }));
    a.download = `gdacaixa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast.success("Backup JSON exportado com sucesso!");
  }

  // 3. Sincronização / Backup para Google Apps Script
  async function triggerGoogleDriveBackup() {
    if (!backupWebhook) {
      const url = prompt(
        "Insira a URL do seu Web App do Google Apps Script (ex: https://script.google.com/macros/s/.../exec):",
        backupWebhook
      );
      if (!url) return;
      localStorage.setItem("gda_backup_webhook", url);
      setBackupWebhook(url);
    }

    const currentUrl = backupWebhook || localStorage.getItem("gda_backup_webhook");
    if (!currentUrl) return;

    toast.info("Enviando backup para o seu Google Drive…");
    try {
      await fetch(currentUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          autor: me?.name || "Tesouraria",
          dados: all,
        }),
      });
      toast.success("Backup transmitido com sucesso ao Google Drive!");
    } catch {
      toast.error("Falha ao comunicar com o script do Google Drive.");
    }
  }

  // 4. Imprimir Balancete Geral Oficial para Atas da Igreja
  function handlePrintConsolidado() {
    generatePrintReport({
      module: "consolidado",
      title: "Balancete Financeiro Geral — Comissão da Igreja",
      responsible: me?.name || "Tesouraria do Clube",
      transactions: all,
      signatures: [
        { role: "Diretor(a) do Clube" },
        { role: "Tesoureiro(a) do Clube" },
        { role: "Pastor / Presidente da Comissão" },
        { role: "Secretário(a) da Igreja" },
      ],
    });
  }

  // Manipular alteração de papel de usuário (com validação hierárquica rigorosa)
  async function handleChangeRole(targetUserId: string, targetCurrentRole: Role, newRole: Role) {
    if (targetCurrentRole === newRole) return;

    // Regras de Segurança:
    // 1. Somente Admin pode promover ou rebaixar alguém para 'admin'
    if ((newRole === "admin" || targetCurrentRole === "admin") && !isAdmin) {
      toast.error("Apenas o Administrador Geral pode conceder ou alterar o cargo de Admin.");
      return;
    }

    // 2. Diretor pode gerenciar diretores, conselheiros e desbravadores
    // 3. Conselheiro só pode alterar membros para 'desbravador'
    if (isConselheiro && !isAdminOrDiretor && newRole !== "desbravador") {
      toast.error("Conselheiros só podem atribuir o papel de Desbravador.");
      return;
    }

    try {
      await updateUserRole(targetUserId, newRole);
      toast.success(`Papel alterado para ${ROLE_LABEL[newRole]} com sucesso!`);
      qc.invalidateQueries({ queryKey: ["all_users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch {
      toast.error("Falha ao atualizar papel do usuário.");
    }
  }

  // Manipular adição de Dívida / Controle Interno
  async function handleAddDivida(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") || "").trim();
    const valor = Number(String(f.get("valor")).replace(",", "."));
    const obs = String(f.get("obs") || "");
    if (!nome || valor <= 0) {
      toast.error("Informe o nome do devedor/favorecido e o valor.");
      return;
    }
    try {
      await addDivida({
        nome,
        valor,
        data: new Date().toISOString().slice(0, 10),
        status: "pendente",
        obs,
      });
      toast.success("Dívida/Controle registrado com sucesso!");
      setDividaDrawerOpen(false);
      qc.invalidateQueries({ queryKey: ["dividas"] });
    } catch {
      toast.error("Erro ao registrar no controle interno.");
    }
  }

  async function handleToggleDivida(id: string, currentStatus: "pendente" | "pago") {
    const next = currentStatus === "pendente" ? "pago" : "pendente";
    try {
      await updateDividaStatus(id, next);
      toast.success(`Dívida marcada como ${next === "pago" ? "quitada" : "pendente"}!`);
      qc.invalidateQueries({ queryKey: ["dividas"] });
    } catch {
      toast.error("Falha ao atualizar status.");
    }
  }

  const items = [
    {
      icon: FileText,
      label: "Central de Histórico & Relatórios",
      sub: "Filtros avançados, vendas por produto, comissões de desbravadores e fechamentos",
      onClick: () => setReportsDrawerOpen(true),
      highlight: true,
    },
    {
      icon: Globe,
      label: "Portal da Transparência Pública",
      sub: "Página pública oficial aberta para pais e comissão da igreja (/transparencia)",
      onClick: () => {
        window.open("/transparencia", "_blank");
      },
    },
    {
      icon: Users2,
      label: "Gerenciamento de Usuários & Cargos",
      sub: `${allUsers.length} membros no clube • Definir Admin, Diretor, Conselheiro`,
      onClick: () => setUsersDrawerOpen(true),
    },
    {
      icon: Printer,
      label: "Imprimir Balancete Geral para Ata",
      sub: "Documento oficial com campos para Diretor, Tesoureiro e Secretário",
      onClick: handlePrintConsolidado,
    },
    {
      icon: Download,
      label: "Exportar Planilha (CSV)",
      sub: `${all.length} movimentações no formato Excel/Sheets`,
      onClick: exportCsv,
    },
    {
      icon: CloudDownload,
      label: "Backup no Google Drive (Apps Script)",
      sub: "Sincroniza automaticamente com seu script pessoal",
      onClick: triggerGoogleDriveBackup,
    },
    {
      icon: Download,
      label: "Exportar Backup Completo (JSON)",
      sub: "Cópia de segurança offline de todo o banco de dados",
      onClick: exportJson,
    },
    {
      icon: Smartphone,
      label: "Instalar PWA no Celular",
      sub: "Toque em Compartilhar / Menu → 'Adicionar à Tela de Início'",
      onClick: () =>
        toast("Dica: Use o menu do navegador para instalar o GDA Caixa 2027 como app nativo!"),
    },
    {
      icon: LogOut,
      label: "Encerrar Sessão",
      sub: me?.email ?? "",
      onClick: signOut,
      danger: true,
    },
  ];

  // Item exclusivo para Admin — limpeza total
  const adminItems = isAdmin
    ? [
        {
          icon: Trash2,
          label: "Limpeza Total do Sistema",
          sub: "Apagar dados ou dados + usuários — ação irreversível",
          onClick: () => setWipeDrawerOpen(true),
          danger: true,
        },
      ]
    : [];

  const totalDividasPendentes = dividas
    .filter((d) => d.status === "pendente")
    .reduce((acc, cur) => acc + cur.valor, 0);

  return (
    <AppShell title="Perfil e Ajustes">
      {/* Card do Perfil do Usuário em M3 */}
      {me && (
        <section className="flex items-center gap-4 rounded-3xl bg-primary-container p-5 text-on-primary-container shadow-sm border-none">
          {me.avatar ? (
            <img
              src={me.avatar}
              alt=""
              className="size-16 rounded-full border-2 border-primary/20 shadow-xs object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-2xl font-black flex size-16 items-center justify-center rounded-full bg-surface text-primary shadow-xs">
              {me.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold truncate text-on-primary-container">{me.name}</p>
            <p className="text-xs truncate opacity-85 mt-0.5">{me.email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {me.roles.map((r) => (
                <span
                  key={r}
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-surface/30 backdrop-blur-xs text-on-primary-container"
                >
                  {ROLE_LABEL[r]}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Módulo de Controle Interno / Dívidas (Admin / Diretor) */}
      {isAdminOrDiretor && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">Controle Interno & Dívidas</h2>
            </div>
            <button
              onClick={() => setDividaDrawerOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <Plus className="size-4" /> Registrar Dívida
            </button>
          </div>

          <div className="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-semibold">Total a Receber</span>
              <p className="text-xl font-black text-income mt-0.5">{brl(totalDividasPendentes)}</p>
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              {dividas.filter((d) => d.status === "pendente").length} pendentes
            </span>
          </div>

          <div className="divide-y divide-outline-variant/20 rounded-3xl bg-surface-container-low border border-outline-variant/20 overflow-hidden">
            {dividas.map((div) => {
              const isPaid = div.status === "pago";
              const pago = div.valor_pago ?? 0;
              const progresso = div.valor > 0 ? Math.min(100, (pago / div.valor) * 100) : 0;
              return (
                <div key={div.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${isPaid ? "line-through opacity-60" : "text-foreground"}`}>
                        {div.nome}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {div.data} {div.obs ? `• ${div.obs}` : ""}
                        {div.delete_after && (
                          <span className="ml-1 text-amber-600 dark:text-amber-400">
                            • Será excluída em {new Date(div.delete_after).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className={`text-sm font-bold block ${isPaid ? "text-muted-foreground" : "text-expense"}`}>
                          {brl(div.valor)}
                        </span>
                        {pago > 0 && !isPaid && (
                          <span className="text-[10px] text-income">pago {brl(pago)}</span>
                        )}
                      </div>
                      {!isPaid && (
                        <button
                          onClick={() => { setPagamentoDrawer(div); setPagamentoValor(""); }}
                          title="Registrar pagamento"
                          className="p-2 rounded-full bg-income/10 text-income hover:bg-income/20 transition-colors"
                        >
                          <CheckCircle2 className="size-4" />
                        </button>
                      )}
                      {isPaid && (
                        <button
                          onClick={() => setPagamentoOpcaoDrawer(div)}
                          title="Opções de exclusão"
                          className="p-2 rounded-full bg-primary-container text-on-primary-container"
                        >
                          <CheckCircle2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {!isPaid && div.valor > 0 && (
                    <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full bg-income rounded-full transition-all"
                        style={{ width: `${progresso}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {!dividas.length && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhuma pendência ou dívida interna registrada.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista de Ações e Relatórios */}
      <h2 className="text-base font-bold text-foreground px-1 pt-2">Administração & Ajustes</h2>
      <ul className="overflow-hidden rounded-3xl bg-surface-container-low border border-outline-variant/20 divide-y divide-outline-variant/20">
        {items.map(({ icon: Icon, label, sub, onClick, danger }) => (
          <li key={label}>
            <button
              onClick={onClick}
              className={`flex min-h-18 w-full items-center gap-4 px-5 py-4 text-left transition-colors active:bg-surface-variant/30 ${
                danger ? "hover:bg-destructive/10" : "hover:bg-surface-container-high/40"
              }`}
            >
              <div
                className={`p-2.5 rounded-2xl ${
                  danger
                    ? "bg-destructive/10 text-destructive"
                    : "bg-surface-container-highest/60 text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${danger ? "text-destructive" : "text-foreground"}`}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
        {adminItems.map(({ icon: Icon, label, sub, onClick, danger }) => (
          <li key={label}>
            <button
              onClick={onClick}
              className="flex min-h-18 w-full items-center gap-4 px-5 py-4 text-left transition-colors active:bg-surface-variant/30 hover:bg-destructive/10"
            >
              <div className="p-2.5 rounded-2xl bg-destructive/10 text-destructive">
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-destructive">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      {/* Rodapé Informativo */}
      <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground/80">GDA Caixa 2027 • v2.0 Mobile-First</p>
        <p>Clube de Desbravadores Guerreiros do Alto • Material Design 3</p>
      </div>

      {/* Drawer para Gestão de Usuários & Cargos (RBAC) */}
      <Drawer open={usersDrawerOpen} onOpenChange={setUsersDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4 max-h-[85vh] flex flex-col">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Hierarquia & Permissões</DrawerTitle>
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? "Como Administrador, você pode atribuir qualquer cargo (Admin, Diretor, Tesoureiro, Conselheiro ou Desbravador)."
                : isAdminOrDiretor
                ? "Como Diretor, você pode atribuir os cargos de Diretor, Tesoureiro, Conselheiro ou Desbravador."
                : "Como Conselheiro, você pode validar membros como Desbravadores."}
            </p>
          </DrawerHeader>

          <div className="overflow-y-auto flex-1 divide-y divide-outline-variant/20 px-2">
            {allUsers.map((u) => {
              const currentRole = u.roles[0] || "desbravador";
              const isSelf = u.id === me?.id;
              return (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {u.name} {isSelf && "(Você)"}
                    </p>
                    <p className="text-xs text-primary font-semibold mt-0.5">
                      {ROLE_LABEL[currentRole]}
                    </p>
                  </div>

                  {canManageAnyUser && !isSelf && (
                    <select
                      value={currentRole}
                      onChange={(e) => handleChangeRole(u.id, currentRole, e.target.value as Role)}
                      className="text-xs font-bold rounded-xl bg-surface-container-high px-3 py-2 text-foreground border border-outline-variant/40 outline-none"
                    >
                      {isAdmin && <option value="admin">Admin</option>}
                      {(isAdmin || isAdminOrDiretor) && <option value="diretor">Diretor</option>}
                      {(isAdmin || isAdminOrDiretor) && <option value="tesoureiro">Tesoureiro</option>}
                      {(isAdmin || isAdminOrDiretor) && <option value="conselheiro">Conselheiro</option>}
                      <option value="desbravador">Desbravador</option>
                    </select>
                  )}
                </div>
              );
            })}
            {!allUsers.length && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhum usuário listado.
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Drawer para Registrar Dívida */}
      <Drawer open={dividaDrawerOpen} onOpenChange={setDividaDrawerOpen}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Registrar Dívida / Controle Interno</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleAddDivida} className="space-y-4 px-2 pb-6">
            <input name="nome" placeholder="Nome da pessoa ou unidade devedora" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <input name="valor" inputMode="decimal" placeholder="Valor devido (R$)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" required />
            <input name="obs" placeholder="Observações (ex: Pegou uniforme adiantado)" className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none" />
            <button type="submit" className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm">Registrar Pendência</button>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Drawer: Central de Histórico & Relatórios da Fase 5 */}
      <ReportsCenterDrawer
        open={reportsDrawerOpen}
        onOpenChange={setReportsDrawerOpen}
      />

      {/* Drawer: Registrar pagamento parcial */}
      <Drawer open={!!pagamentoDrawer} onOpenChange={(v) => !v && setPagamentoDrawer(null)}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4 pb-8 space-y-4">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">Registrar Pagamento</DrawerTitle>
            {pagamentoDrawer && (
              <p className="text-xs text-muted-foreground">
                {pagamentoDrawer.nome} — Faltam {brl(pagamentoDrawer.valor - (pagamentoDrawer.valor_pago ?? 0))}
              </p>
            )}
          </DrawerHeader>
          <input
            value={pagamentoValor}
            onChange={(e) => setPagamentoValor(e.target.value)}
            inputMode="decimal"
            placeholder="Valor pago agora (R$)"
            className="h-14 w-full rounded-2xl border border-outline-variant/60 bg-surface px-4 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={async () => {
              if (!pagamentoDrawer) return;
              const v = parseFloat(pagamentoValor.replace(",", "."));
              if (!v || v <= 0) { toast.error("Informe um valor válido."); return; }
              const novoTotal = (pagamentoDrawer.valor_pago ?? 0) + v;
              try {
                const { quitado } = await registrarPagamentoParcial(pagamentoDrawer.id, v, novoTotal, pagamentoDrawer.valor);
                toast.success(quitado ? "Dívida quitada!" : `Pagamento de ${brl(v)} registrado!`);
                qc.invalidateQueries({ queryKey: ["dividas"] });
                if (quitado) {
                  setPagamentoDrawer(null);
                  setPagamentoOpcaoDrawer({ ...pagamentoDrawer, valor_pago: novoTotal, status: "pago" });
                } else {
                  setPagamentoDrawer(null);
                }
              } catch { toast.error("Erro ao registrar pagamento."); }
            }}
            className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
          >
            Confirmar Pagamento
          </button>
        </DrawerContent>
      </Drawer>

      {/* Drawer: Opções após quitação */}
      <Drawer open={!!pagamentoOpcaoDrawer} onOpenChange={(v) => !v && setPagamentoOpcaoDrawer(null)}>
        <DrawerContent className="rounded-t-3xl bg-surface-container-low max-w-lg mx-auto p-4 pb-8 space-y-4">
          <DrawerHeader>
            <DrawerTitle className="text-lg font-black text-foreground">🎉 Dívida Quitada!</DrawerTitle>
            <p className="text-xs text-muted-foreground">
              O que deseja fazer com este registro?
            </p>
          </DrawerHeader>
          <button
            onClick={async () => {
              if (!pagamentoOpcaoDrawer) return;
              try {
                await agendarExclusaoDivida(pagamentoOpcaoDrawer.id, 7);
                toast.success("Será excluída automaticamente em 7 dias.");
                qc.invalidateQueries({ queryKey: ["dividas"] });
                setPagamentoOpcaoDrawer(null);
              } catch { toast.error("Erro."); }
            }}
            className="h-12 w-full rounded-2xl bg-surface-container-high border border-outline-variant/40 text-foreground font-bold text-sm"
          >
            Excluir em 7 dias
          </button>
          <button
            onClick={() => setPagamentoOpcaoDrawer(null)}
            className="h-12 w-full rounded-2xl bg-surface-container-high border border-outline-variant/40 text-foreground font-semibold text-sm"
          >
            Manter no histórico
          </button>
          <button
            onClick={async () => {
              if (!pagamentoOpcaoDrawer) return;
              try {
                await deleteDivida(pagamentoOpcaoDrawer.id);
                toast.success("Dívida removida.");
                qc.invalidateQueries({ queryKey: ["dividas"] });
                setPagamentoOpcaoDrawer(null);
              } catch { toast.error("Erro ao excluir."); }
            }}
            className="h-12 w-full rounded-2xl border border-destructive/40 text-destructive font-bold text-sm hover:bg-destructive/10"
          >
            Excluir imediatamente
          </button>
        </DrawerContent>
      </Drawer>

      {/* Drawer: Limpeza Total — exclusivo para Admin */}
      {isAdmin && (
        <WipeDataDrawer
          open={wipeDrawerOpen}
          onOpenChange={setWipeDrawerOpen}
        />
      )}
    </AppShell>
  );
}
