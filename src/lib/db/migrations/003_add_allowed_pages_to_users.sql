-- Migration: Add allowed_pages column to users table for granular page permissions
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_pages TEXT;
COMMENT ON COLUMN users.allowed_pages IS 'JSON array of allowed merchant routes for this employee, e.g. ["/merchant/pos", "/merchant/products"]';

