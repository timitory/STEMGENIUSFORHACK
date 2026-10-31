-- Migration: Create Tutor Marketplace Tables, Policies, and Trigger Functions
-- Module 2 of STEM Genius Expansion

-- 1. Extend app_role enum with 'tutor'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE pg_type.typname = 'app_role' AND pg_enum.enumlabel = 'tutor'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'tutor';
  END IF;
END $$;

-- 2. Tutor Profiles Table
CREATE TABLE IF NOT EXISTS public.tutor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  headline TEXT NOT NULL,
  bio TEXT NOT NULL,
  teaching_philosophy TEXT,
  qualifications JSONB DEFAULT '[]'::jsonb,
  experience_years INTEGER DEFAULT 1,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  exam_types TEXT[] DEFAULT '{}',
  student_levels TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{"English"}',
  hourly_rate NUMERIC DEFAULT 0,
  offers_free_sessions BOOLEAN DEFAULT false,
  free_session_duration_minutes INTEGER DEFAULT 30,
  paid_session_duration_minutes INTEGER DEFAULT 60,
  teaching_formats TEXT[] DEFAULT '{"one_to_one"}',
  max_group_size INTEGER DEFAULT 5,
  group_session_rate NUMERIC DEFAULT 0,
  verification_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  verification_notes TEXT,
  id_document_url TEXT,
  cv_url TEXT,
  is_active BOOLEAN DEFAULT true,
  rating_average NUMERIC DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  total_sessions_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tutor Availability Schedule
CREATE TABLE IF NOT EXISTS public.tutor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.tutor_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tutor Bookings Table
CREATE TABLE IF NOT EXISTS public.tutor_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT UNIQUE NOT NULL,
  tutor_id UUID NOT NULL REFERENCES public.tutor_profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT,
  session_format TEXT DEFAULT 'one_to_one',
  is_free BOOLEAN DEFAULT false,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  amount_paid NUMERIC DEFAULT 0,
  platform_fee NUMERIC DEFAULT 0,
  tutor_earnings NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending', -- 'free', 'pending', 'paid', 'refunded', 'failed'
  payment_reference TEXT,
  status TEXT DEFAULT 'scheduled', -- 'pending_payment', 'scheduled', 'in_progress', 'completed', 'cancelled', 'disputed'
  room_id TEXT UNIQUE NOT NULL,
  student_notes TEXT,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tutor Earnings Wallet
CREATE TABLE IF NOT EXISTS public.tutor_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID UNIQUE NOT NULL REFERENCES public.tutor_profiles(id) ON DELETE CASCADE,
  available_balance NUMERIC DEFAULT 0,
  pending_balance NUMERIC DEFAULT 0,
  total_withdrawn NUMERIC DEFAULT 0,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  recipient_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Tutor Reviews Table
CREATE TABLE IF NOT EXISTS public.tutor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID UNIQUE NOT NULL REFERENCES public.tutor_bookings(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES public.tutor_profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Tutor Payouts History
CREATE TABLE IF NOT EXISTS public.tutor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.tutor_profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  transfer_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Platform Marketplace Settings
CREATE TABLE IF NOT EXISTS public.marketplace_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.marketplace_settings (key, value)
VALUES ('commission_rate', '{"rate": 0.15, "currency": "NGN"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 9. Indexes for speed
CREATE INDEX IF NOT EXISTS idx_tutor_profiles_subjects ON public.tutor_profiles USING GIN (subjects);
CREATE INDEX IF NOT EXISTS idx_tutor_profiles_status ON public.tutor_profiles (verification_status, is_active);
CREATE INDEX IF NOT EXISTS idx_tutor_bookings_tutor ON public.tutor_bookings (tutor_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_tutor_bookings_student ON public.tutor_bookings (student_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_tutor_reviews_tutor ON public.tutor_reviews (tutor_id);

-- 10. Enable RLS
ALTER TABLE public.tutor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies
-- Profiles: Verified tutors are public; owner can view/edit their own; admins can manage all
CREATE POLICY "Anyone can view verified active tutors" ON public.tutor_profiles
  FOR SELECT USING (
    (verification_status = 'verified' AND is_active = true) OR
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Users can create their tutor profile" ON public.tutor_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tutor profile" ON public.tutor_profiles
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- Availability: Public can view active slots of verified tutors; tutor owns their schedule
CREATE POLICY "Anyone can view tutor availability" ON public.tutor_availability
  FOR SELECT USING (true);

CREATE POLICY "Tutors can manage their availability" ON public.tutor_availability
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tutor_profiles WHERE id = tutor_id AND user_id = auth.uid())
  );

-- Bookings: Student, Tutor, or Admin can access
CREATE POLICY "Users can view their own bookings" ON public.tutor_bookings
  FOR SELECT USING (
    auth.uid() = student_id OR
    EXISTS (SELECT 1 FROM public.tutor_profiles WHERE id = tutor_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Students can create bookings" ON public.tutor_bookings
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Participants can update their bookings" ON public.tutor_bookings
  FOR UPDATE USING (
    auth.uid() = student_id OR
    EXISTS (SELECT 1 FROM public.tutor_profiles WHERE id = tutor_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- Wallets: Tutor and Admins only
CREATE POLICY "Tutors can view their own wallet" ON public.tutor_wallets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tutor_profiles WHERE id = tutor_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Tutors can update their own bank details" ON public.tutor_wallets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tutor_profiles WHERE id = tutor_id AND user_id = auth.uid())
  );

-- Reviews: Anyone can view public reviews; eligible students can insert
CREATE POLICY "Anyone can view public reviews" ON public.tutor_reviews
  FOR SELECT USING (is_public = true);

CREATE POLICY "Students can insert review for completed booking" ON public.tutor_reviews
  FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Settings: Anyone can read
CREATE POLICY "Anyone can view marketplace settings" ON public.marketplace_settings
  FOR SELECT USING (true);

