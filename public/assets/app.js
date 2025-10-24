import { supabase } from '../supabaseConfig.js';

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(userId) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return profile;
}

export async function redirectBasedOnRole() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const profile = await getUserProfile(user.id);

  if (!profile) {
    console.error('No profile found for user');
    await supabase.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  const currentPage = window.location.pathname.split('/').pop();

  const rolePages = {
    admin: 'admin-dashboard.html',
    student: 'student-dashboard.html',
    parent: 'parent-dashboard.html'
  };

  const expectedPage = rolePages[profile.role];

  if (currentPage !== expectedPage && !currentPage.includes('report.html')) {
    window.location.href = expectedPage;
  }
}

export function setupAuthStateListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    (() => {
      if (event === 'SIGNED_OUT') {
        window.location.href = 'login.html';
      } else if (event === 'SIGNED_IN') {
        redirectBasedOnRole();
      }
    })();
  });
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    return false;
  }

  window.location.href = 'login.html';
  return true;
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatCurrency(amount) {
  return `₹${parseFloat(amount).toFixed(2)}`;
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validateMobile(mobile) {
  const re = /^[0-9]{10}$/;
  return re.test(mobile);
}
