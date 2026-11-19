import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MetaDrawer } from "@/components/m3/MetaDrawer";
import * as dataModule from "@/lib/data";
import type { Meta } from "@/lib/data";

vi.mock("@/lib/data", () => ({
  addMeta: vi.fn().mockResolvedValue(undefined),
  updateMeta: vi.fn().mockResolvedValue(undefined),
  deleteMeta: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const SAMPLE_META: Meta = {
  id: "meta-1",
  modulo: "clube",
  descricao: "Campori 2027",
  valor_alvo: 1500,
  status: "aprovada",
};

describe("MetaDrawer — modo criação", () => {
  it("renderiza sem o botão Excluir", () => {
    render(<MetaDrawer open onOpenChange={vi.fn()} />, { wrapper });
    expect(screen.queryByText(/excluir meta/i)).toBeNull();
  });

  it("chama addMeta com os valores corretos ao salvar", async () => {
    render(<MetaDrawer open onOpenChange={vi.fn()} />, { wrapper });

    fireEvent.change(screen.getByPlaceholderText(/descrição/i), {
      target: { value: "Nova meta teste" },
    });
    fireEvent.change(screen.getByPlaceholderText(/0,00/), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByText(/salvar/i));

    await waitFor(() => {
      expect(dataModule.addMeta).toHaveBeenCalledWith(
        expect.objectContaining({ descricao: "Nova meta teste", valor_alvo: 500 })
      );
    });
  });
});

describe("MetaDrawer — modo edição", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preenche os campos com os dados da meta recebida", () => {
    render(<MetaDrawer open onOpenChange={vi.fn()} meta={SAMPLE_META} />, { wrapper });
    expect((screen.getByDisplayValue("Campori 2027") as HTMLInputElement).value).toBe("Campori 2027");
  });

  it("exibe o botão Excluir", () => {
    render(<MetaDrawer open onOpenChange={vi.fn()} meta={SAMPLE_META} />, { wrapper });
    expect(screen.getByText(/excluir meta/i)).toBeTruthy();
  });

  it("chama updateMeta ao salvar em modo edição", async () => {
    render(<MetaDrawer open onOpenChange={vi.fn()} meta={SAMPLE_META} />, { wrapper });
    fireEvent.click(screen.getByText(/salvar/i));
    await waitFor(() => {
      expect(dataModule.updateMeta).toHaveBeenCalledWith("meta-1", expect.any(Object));
    });
  });

  it("exige confirmação antes de chamar deleteMeta", async () => {
    render(<MetaDrawer open onOpenChange={vi.fn()} meta={SAMPLE_META} />, { wrapper });

    fireEvent.click(screen.getByText(/excluir meta/i));
    // Confirmação inline aparece
    expect(screen.getByText(/confirmar exclusão/i)).toBeTruthy();
    // deleteMeta ainda não foi chamado
    expect(dataModule.deleteMeta).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(/confirmar/i));
    await waitFor(() => {
      expect(dataModule.deleteMeta).toHaveBeenCalledWith("meta-1");
    });
  });
});
