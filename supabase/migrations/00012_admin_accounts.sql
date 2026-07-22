-- 1. Enable pgcrypto extension for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create admin_accounts table
CREATE TABLE IF NOT EXISTS admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'superadmin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS (Restricted to service role server API routes only)
ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;

-- 4. Function to securely verify admin credentials against stored hash
CREATE OR REPLACE FUNCTION verify_admin_credentials(p_username TEXT, p_password TEXT)
RETURNS TABLE (id UUID, username TEXT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.username, a.role
  FROM admin_accounts a
  WHERE LOWER(a.username) = LOWER(p_username)
    AND a.password_hash = crypt(p_password, a.password_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Insert initial admin user 'Minhaze' with hashed password 'Fuad#219'
INSERT INTO admin_accounts (username, password_hash, role)
VALUES ('Minhaze', crypt('Fuad#219', gen_salt('bf')), 'superadmin')
ON CONFLICT (username) 
DO UPDATE SET password_hash = crypt('Fuad#219', gen_salt('bf'));
