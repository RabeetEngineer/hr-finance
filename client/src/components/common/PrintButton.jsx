import { Printer } from "lucide-react";

const PrintButton = ({ label = "Print" }) => {
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
};

export default PrintButton;

