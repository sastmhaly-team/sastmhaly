'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, Branch } from '../types';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  branches: Branch[];
  activeBranchId: string; // 'all' or branch_id
  activeBranch: Branch | null;
  setActiveBranchId: (branchId: string) => void;
  loginAs: (username: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  canAccessBranch: (branchId: string) => boolean;
  isSuperAdmin: boolean;
  isMerchantOwner: boolean;
  isCashier: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load session from localStorage
  useEffect(() => {
    const initSession = async () => {
      try {
        const savedIdentifier = localStorage.getItem('sastmhaly_user');
        if (savedIdentifier) {
          await loginAs(savedIdentifier);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to load session', err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    initSession();
  }, []);

  const loginAs = async (identifier: string): Promise<boolean> => {
    // 1. If offline, try restoring cached session immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = localStorage.getItem('sastmhaly_cached_session');
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data.user) {
            setUser(data.user);
            setTenant(data.tenant || null);
            setBranches(data.branches || []);
            const isMainAccount = data.user.role === 'merchant_owner' || data.user.role === 'owner' || data.user.role === 'admin' || data.user.role === 'super_admin';
            const branchId = !isMainAccount && data.user.branch_id 
              ? data.user.branch_id 
              : (localStorage.getItem('sastmhaly_branch') || 'all');
            setActiveBranchIdState(branchId);
            return true;
          }
        } catch {}
      }
    }

    try {
      const res = await fetch(`/api/auth/session?username=${encodeURIComponent(identifier)}`);
      if (!res.ok) {
        // If server actively rejected the user, clear
        localStorage.removeItem('sastmhaly_user');
        localStorage.removeItem('sastmhaly_cached_session');
        setUser(null);
        return false;
      }
      const data = await res.json();
      
      setUser(data.user);
      setTenant(data.tenant || null);
      setBranches(data.branches || []);
      
      const isMainAccount = data.user.role === 'merchant_owner' || data.user.role === 'owner' || data.user.role === 'admin' || data.user.role === 'super_admin';
      const branchId = !isMainAccount && data.user.branch_id 
        ? data.user.branch_id 
        : (localStorage.getItem('sastmhaly_branch') || 'all');
      setActiveBranchIdState(branchId);
      
      localStorage.setItem('sastmhaly_user', identifier);
      // Persist session snapshot for offline access
      localStorage.setItem('sastmhaly_cached_session', JSON.stringify({
        user: data.user,
        tenant: data.tenant,
        branches: data.branches,
      }));
      return true;
    } catch {
      // Network failure (offline / timeout) - Fallback to cached session instead of logging out!
      const cached = localStorage.getItem('sastmhaly_cached_session');
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data.user) {
            console.warn('[Offline Mode] Restored user session from local cache');
            setUser(data.user);
            setTenant(data.tenant || null);
            setBranches(data.branches || []);
            const isMainAccount = data.user.role === 'merchant_owner' || data.user.role === 'owner' || data.user.role === 'admin' || data.user.role === 'super_admin';
            const branchId = !isMainAccount && data.user.branch_id 
              ? data.user.branch_id 
              : (localStorage.getItem('sastmhaly_branch') || 'all');
            setActiveBranchIdState(branchId);
            return true;
          }
        } catch {}
      }

      localStorage.removeItem('sastmhaly_user');
      setUser(null);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    setBranches([]);
    setActiveBranchIdState('all');
    localStorage.removeItem('sastmhaly_user');
    localStorage.removeItem('sastmhaly_branch');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const setActiveBranchId = (branchId: string) => {
    const isMainAccount = user?.role === 'merchant_owner' || user?.role === 'super_admin';
    if (!isMainAccount && user?.branch_id && user.branch_id !== branchId) {
      // Locked subordinate employee cannot change branch
      return;
    }
    setActiveBranchIdState(branchId);
    localStorage.setItem('sastmhaly_branch', branchId);
  };

  const activeBranch = branches.find(b => b.id === activeBranchId) || null;

  const canAccessBranch = (branchId: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'merchant_owner') return true;
    return user.branch_id === branchId;
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isMerchantOwner = user?.role === 'merchant_owner';
  const isCashier = user?.role === 'cashier';

  return (
    <AuthContext.Provider value={{
      user,
      tenant,
      branches,
      activeBranchId,
      activeBranch,
      setActiveBranchId,
      loginAs,
      logout,
      isLoading,
      canAccessBranch,
      isSuperAdmin,
      isMerchantOwner,
      isCashier
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
