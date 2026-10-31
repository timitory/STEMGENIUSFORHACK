-- Add additional user profile fields for enhanced authentication
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT FALSE;

-- Update existing profiles to have email_confirmed as true for backwards compatibility
UPDATE public.profiles SET email_confirmed = TRUE WHERE email_confirmed IS NULL;

-- Add index for phone number for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.phone IS 'User phone number for contact and verification';
COMMENT ON COLUMN public.profiles.gender IS 'User gender preference';
COMMENT ON COLUMN public.profiles.address IS 'User address for delivery and location services';
COMMENT ON COLUMN public.profiles.email_confirmed IS 'Whether user has confirmed their email address';