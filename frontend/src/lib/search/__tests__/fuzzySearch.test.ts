import { CommandItem, fuzzySearchCommands } from "../fuzzySearch";

const testCommands: CommandItem[] = [
  { id: "1", title: "Create Scheduled Task", category: "Tasks", action: () => {} },
  { id: "2", title: "Switch to Mainnet", category: "Navigation", action: () => {} },
  { id: "3", title: "Inspect Contract Logs", category: "Contracts", action: () => {} },
];

describe("Universal Command Palette Search", () => {
  it("returns all items when query is empty", () => {
    const res = fuzzySearchCommands(testCommands, "");
    expect(res).toHaveLength(3);
  });

  it("filters items by matching title substring", () => {
    const res = fuzzySearchCommands(testCommands, "task");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("1");
  });

  it("filters items by matching category", () => {
    const res = fuzzySearchCommands(testCommands, "navigation");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("2");
  });
});
