import { DirectorDashboard } from '../components/director/DirectorDashboard';
import { useDesign } from '../store/DesignContext';

export function DashboardPage() {
  const { isZen } = useDesign();
  return <DirectorDashboard variant={isZen ? 'zen' : 'theater'} />;
}
