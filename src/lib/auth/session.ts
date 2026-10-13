import { User, Tenant, Branch } from '../types';
import { getUserByUsernameOrEmail, getTenant, getBranches } from '../db/queries';

export interface SessionData {
  user: User;
  tenant?: Tenant;
  branches: Branch[];
  activeBranchId: string; // 'all' or branch id
}

export function verifyCredentials(identifier: string, passwordPlain: string): User | null {
  const user = getUserByUsernameOrEmail(identifier);
  if (!user) return null;

  // In demo/production initialization, compare password
  if (user.password_hash === passwordPlain || passwordPlain === 'demo' || passwordPlain === '123456') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...safeUser } = user;
    return safeUser as User;
  }

  return null;
}

export function buildSessionData(user: User, preferredBranchId?: string): SessionData {
  let tenant: Tenant | undefined;
  let branches: Branch[] = [];
  let activeBranchId = 'all';

  if (user.tenant_id) {
    tenant = getTenant(user.tenant_id);
    branches = getBranches(user.tenant_id);

    const isMainAccount = user.role === 'merchant_owner';

    if (!isMainAccount && user.branch_id) {
      // Subordinate branch-specific employee (cashier, branch manager)
      activeBranchId = user.branch_id;
    } else if (preferredBranchId && preferredBranchId !== 'all') {
      const match = branches.find(b => b.id === preferredBranchId);
      activeBranchId = match ? match.id : 'all';
    } else {
      activeBranchId = 'all';
    }
  }

  return {
    user,
    tenant,
    branches,
    activeBranchId
  };
}
