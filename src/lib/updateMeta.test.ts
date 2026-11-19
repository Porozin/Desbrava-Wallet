import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
const mockFrom = vi.fn(() => ({ update: mockUpdate }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

async function getUpdateMeta() {
  const mod = await import("./data");
  return mod.updateMeta;
}

describe("updateMeta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it("calls metas table with correct id and changes", async () => {
    const updateMeta = await getUpdateMeta();
    await updateMeta("meta-123", { descricao: "Nova desc", status: "concluida" });
    expect(mockFrom).toHaveBeenCalledWith("metas");
    expect(mockUpdate).toHaveBeenCalledWith({ descricao: "Nova desc", status: "concluida" });
  });

  it("throws when Supabase returns an error", async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: "RLS denied" } });
    mockUpdate.mockReturnValue({ eq: mockEq });
    const updateMeta = await getUpdateMeta();
    await expect(updateMeta("meta-123", { status: "concluida" })).rejects.toThrow("RLS denied");
  });
});
