import PageHeader from "@/components/layout/PageHeader";
import ModulePlaceholder from "@/components/common/ModulePlaceholder";

const PlaceholderPage = ({ title, description, points = [] }) => {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <ModulePlaceholder title={title} description={description} points={points} />
    </div>
  );
};

export default PlaceholderPage;

