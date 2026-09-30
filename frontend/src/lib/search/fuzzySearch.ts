export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Tasks' | 'Contracts' | 'Actions';
  action: () => void;
}

export function fuzzySearchCommands(commands: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return commands;

  const q = query.toLowerCase();
  return commands.filter((cmd) => {
    const titleMatch = cmd.title.toLowerCase().includes(q);
    const subMatch = cmd.subtitle ? cmd.subtitle.toLowerCase().includes(q) : false;
    const catMatch = cmd.category.toLowerCase().includes(q);
    return titleMatch || subMatch || catMatch;
  });
}
