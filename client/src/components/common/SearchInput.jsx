import { Search } from "lucide-react";

const SearchInput = ({ value, onChange, onSearch, placeholder = "Search..." }) => {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && onSearch) {
      event.preventDefault();
      onSearch();
    }
  };

  return (
    <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        type="search"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {onSearch ? (
        <button type="button" className="btn-secondary h-9 px-3 py-0 text-xs" onClick={onSearch}>
          Search
        </button>
      ) : null}
    </div>
  );
};

export default SearchInput;

