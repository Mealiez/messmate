import { useTenantContext } from '../context/TenantContext';

export const useFeatureFlags = () => {
  const { features } = useTenantContext();
  const hasFeature = (featureId: string): boolean => features.includes(featureId);
  return { hasFeature, features };
};
