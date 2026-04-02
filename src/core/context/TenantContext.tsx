import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../supabase/client'; // Assuming supabase client will be created/moved

export interface TenantContextType {
  tenantId: string | null;
  role: string | null;
  studentId: string | null;
  plan: string;
  features: string[];
  customConfig: Record<string, any>;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>('free');
  const [features, setFeatures] = useState<string[]>([]);
  const [customConfig, setCustomConfig] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTenantConfig = async () => {
      try {
        setIsLoading(true);
        // 1. Get current user
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setIsLoading(false);
          return;
        }

        // 2. Fetch User Profile to get tenant_id and role
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tenant_id, role')
          .eq('id', session.user.id)
          .single();

        if (profile?.tenant_id) {
          const currentTenantId = profile.tenant_id;
          setTenantId(currentTenantId);
          setRole(profile.role);

          // If student, get student_id
          let currentStudentId = null;
          if (profile.role === 'student') {
            const { data: studentRecord } = await supabase
              .from('students')
              .select('id')
              .eq('user_id', session.user.id)
              .single();
            if (studentRecord) currentStudentId = studentRecord.id;
            setStudentId(currentStudentId);
          }

          // 3. Fetch Tenant Details concurrently
          const [tenantRes, featuresRes, configRes] = await Promise.all([
            supabase.from('tenants').select('plan').eq('id', currentTenantId).single(),
            supabase.from('tenant_features').select('feature_id').eq('tenant_id', currentTenantId).eq('enabled', true),
            supabase.from('custom_config').select('config').eq('tenant_id', currentTenantId).single()
          ]);

          if (tenantRes.data) setPlan(tenantRes.data.plan);
          if (featuresRes.data) setFeatures(featuresRes.data.map(f => f.feature_id));
          if (configRes.data) setCustomConfig(configRes.data.config || {});
        }
      } catch (error) {
        console.error("Error fetching tenant config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenantConfig();

    // Set up auth state change listener to refetch on login/logout
    const { data: authListener } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_IN') {
        fetchTenantConfig();
      } else if (event === 'SIGNED_OUT') {
        setTenantId(null);
        setRole(null);
        setStudentId(null);
        setPlan('free');
        setFeatures([]);
        setCustomConfig({});
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <TenantContext.Provider value={{ tenantId, role, studentId, plan, features, customConfig, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenantContext = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
};
