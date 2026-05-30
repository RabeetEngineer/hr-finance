const PageHeader = ({ title, description, actions }) => {
  return (
    <div className="mb-3 flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">Government of Punjab</p>
        <h2 className="text-xl font-black text-foreground md:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
};

export default PageHeader;
