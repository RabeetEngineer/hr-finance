import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/utils/cn";

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

const Modal = ({ open, title, description, children, onClose, size = "md" }) => {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "relative z-10 w-full overflow-hidden rounded-[2rem] border border-border bg-surface shadow-soft",
              sizeMap[size] || sizeMap.md
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                {title ? <h3 className="text-2xl font-bold text-foreground">{title}</h3> : null}
                {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
              </div>
              <button
                type="button"
                className="rounded-2xl border border-border bg-surface p-2 text-foreground/70 transition hover:bg-muted hover:text-foreground"
                onClick={onClose}
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};

export default Modal;

