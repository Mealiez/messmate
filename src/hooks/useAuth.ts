import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export function useAuth(requiredRole?: string) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          if (requiredRole) window.location.href = '/login.html';
          return;
        }

        if (mounted) setUser(session.user);

        const { data: userProfile, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (mounted) setProfile(userProfile);

        if (requiredRole && userProfile?.role !== requiredRole) {
           window.location.href = '/login.html';
        }

      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && requiredRole) {
        window.location.href = '/login.html';
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [requiredRole]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
  };

  return { user, profile, loading, signOut };
}
