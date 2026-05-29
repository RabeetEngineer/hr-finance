import { Info } from "lucide-react";

const ModulePlaceholder = ({ title, description, points = [], action }) => {
  return (
    <div className="section-shell">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Info className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          {points.length ? (
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {action ? <div className="mt-5">{action}</div> : null}
        </div>
      </div>
    </div>
  );
};

export default ModulePlaceholder;

