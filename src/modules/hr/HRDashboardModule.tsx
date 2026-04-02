import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { Settings, CheckSquare, Square, Building2, Search, Save } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface Feature {
  id: string;
  name: string;
  description: string;
}

interface TenantFeature {
  tenant_id: string;
  feature_id: string;
  enabled: boolean;
}

export const HRDashboardModule: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [tenantFeatures, setTenantFeatures] = useState<TenantFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [tenantsRes, featuresRes, tenantFeaturesRes] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('features').select('*'),
      supabase.from('tenant_features').select('*')
    ]);

    if (tenantsRes.data) setTenants(tenantsRes.data);
    if (featuresRes.data) setFeatures(featuresRes.data);
    if (tenantFeaturesRes.data) setTenantFeatures(tenantFeaturesRes.data);
    setLoading(false);
  };

  const toggleFeature = async (tenantId: string, featureId: string, currentlyEnabled: boolean) => {
    setSaving(`${tenantId}-${featureId}`);
    const newValue = !currentlyEnabled;

    const { error } = await supabase
      .from('tenant_features')
      .upsert({ tenant_id: tenantId, feature_id: featureId, enabled: newValue }, { onConflict: 'tenant_id, feature_id' });

    if (!error) {
      setTenantFeatures(prev => {
        const existing = prev.find(pf => pf.tenant_id === tenantId && pf.feature_id === featureId);
        if (existing) {
          return prev.map(pf => pf.tenant_id === tenantId && pf.feature_id === featureId ? { ...pf, enabled: newValue } : pf);
        } else {
          return [...prev, { tenant_id: tenantId, feature_id: featureId, enabled: newValue }];
        }
      });
    } else {
      alert("Error toggling feature: " + error.message);
    }
    setSaving(null);
  };

  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg">
            <Settings className="w-6 h-6 text-blue-400" />
          </div>
          <div>
             <h3 className="text-xl font-bold">Super Admin / HR Dashboard</h3>
             <p className="text-sm text-slate-400">Manage tenant feature allocations to control dynamic MS administration views.</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
         <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
               type="text"
               placeholder="Search messes/tenants..."
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
         </div>
      </div>

      {/* Main Content List */}
      <div className="p-6">
        {loading ? (
           <div className="flex justify-center p-12">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
           </div>
        ) : (
          <div className="space-y-8">
            {filteredTenants.map(tenant => (
               <div key={tenant.id} className="bg-white border hover:border-blue-300 transition-colors rounded-xl shadow-sm overflow-hidden">
                 <div className="px-5 py-4 bg-slate-50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <Building2 className="w-5 h-5 text-slate-500" />
                       <div>
                          <h4 className="font-bold text-gray-800 text-lg">{tenant.name}</h4>
                          <p className="text-xs text-gray-500">Slug: {tenant.slug} | Plan: <span className="uppercase font-semibold text-blue-600">{tenant.plan}</span></p>
                       </div>
                    </div>
                 </div>
                 
                 <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {features.map(feature => {
                       const tf = tenantFeatures.find(f => f.tenant_id === tenant.id && f.feature_id === feature.id);
                       const isEnabled = tf?.enabled ?? false;
                       const isSaving = saving === `${tenant.id}-${feature.id}`;

                       return (
                          <div 
                             key={feature.id} 
                             onClick={() => !isSaving && toggleFeature(tenant.id, feature.id, isEnabled)}
                             className={`cursor-pointer flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                               isEnabled ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'
                             } ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                             <div className="mt-0.5">
                               {isSaving ? (
                                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
                               ) : isEnabled ? (
                                  <CheckSquare className="w-5 h-5 text-blue-600" />
                               ) : (
                                  <Square className="w-5 h-5 text-gray-300" />
                               )}
                             </div>
                             <div>
                               <h5 className={`font-semibold text-sm ${isEnabled ? 'text-blue-900' : 'text-gray-700'}`}>{feature.name}</h5>
                               <p className={`text-xs mt-1 ${isEnabled ? 'text-blue-700/80' : 'text-gray-500'}`}>{feature.description}</p>
                             </div>
                          </div>
                       );
                    })}
                 </div>
               </div>
            ))}
            
            {filteredTenants.length === 0 && (
               <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <h3 className="text-lg font-medium text-gray-600">No tenants found</h3>
                  <p className="text-sm text-gray-400 mt-1">Try adjusting your search</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
