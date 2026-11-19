import { describe, it, expect, vi, beforeEach } from "vitest";

// Unit tests for wipeAllData and wipeAllDataWithUsers in src/lib/data.ts
// These mock the Supabase client to verify the correct RPC is called with the right params.

const mockRpc = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mockRpc,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
  },
}));

// Lazy-import after mocks are registered
async function getWipeFunctions() {
  const mod = await import("./data");
  return { wipeAllData: mod.wipeAllData, wipeAllDataWithUsers: mod.wipeAllDataWithUsers };
}

describe("wipeAllData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { transactions: 5, metas: 2 }, error: null });
  });

  it("calls sp_wipe_all_data with p_include_users: false", async () => {
    const { wipeAllData } = await getWipeFunctions();
    await wipeAllData();
    expect(mockRpc).toHaveBeenCalledWith("sp_wipe_all_data", { p_include_users: false });
  });

  it("returns the jsonb counts from the RPC", async () => {
    const { wipeAllData } = await getWipeFunctions();
    const result = await wipeAllData();
    expect(result).toEqual({ transactions: 5, metas: 2 });
  });

  it("throws when RPC returns an error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "Permission denied" } });
    const { wipeAllData } = await getWipeFunctions();
    await expect(wipeAllData()).rejects.toThrow("Permission denied");
  });
});

describe("wipeAllDataWithUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { transactions: 5, auth_users: 3 }, error: null });
  });

  it("calls sp_wipe_all_data with p_include_users: true", async () => {
    const { wipeAllDataWithUsers } = await getWipeFunctions();
    await wipeAllDataWithUsers();
    expect(mockRpc).toHaveBeenCalledWith("sp_wipe_all_data", { p_include_users: true });
  });

  it("returns auth_users count in result", async () => {
    const { wipeAllDataWithUsers } = await getWipeFunctions();
    const result = await wipeAllDataWithUsers();
    expect((result as any).auth_users).toBe(3);
  });

  it("throws when RPC returns an error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "RPC error" } });
    const { wipeAllDataWithUsers } = await getWipeFunctions();
    await expect(wipeAllDataWithUsers()).rejects.toThrow("RPC error");
  });
});
