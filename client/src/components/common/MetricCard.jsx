import { motion } from "framer-motion";

const MetricCard = ({ icon: Icon, label, value, detail, accent = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="card-surface p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <h3 className="mt-2 text-3xl font-bold text-foreground">{value}</h3>
          {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}>
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </div>
      </div>
    </motion.div>
  );
};

export default MetricCard;

