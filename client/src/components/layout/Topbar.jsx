import { Menu } from "lucide-react";

const Topbar = ({ onMenuToggle }) => {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-xl md:hidden">
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold">Menu</span>
      </div>
    </header>
  );
};

export default Topbar;
