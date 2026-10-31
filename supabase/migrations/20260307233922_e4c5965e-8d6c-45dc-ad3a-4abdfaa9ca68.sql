
-- Create opportunity categories enum
CREATE TYPE public.opportunity_category AS ENUM (
  'hackathon', 'scholarship', 'grant', 'training', 'class', 
  'event', 'internship', 'fellowship', 'competition', 'funding', 'other'
);

-- Opportunities table
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category opportunity_category NOT NULL DEFAULT 'event',
  organization TEXT,
  location TEXT,
  is_remote BOOLEAN DEFAULT false,
  deadline TIMESTAMP WITH TIME ZONE,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  external_url TEXT,
  has_in_app_form BOOLEAN DEFAULT false,
  form_fields JSONB DEFAULT '[]',
  eligibility TEXT,
  prize_amount NUMERIC DEFAULT 0,
  is_approved BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  applications_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Applications table
CREATE TABLE public.opportunity_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  form_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  UNIQUE(opportunity_id, user_id)
);

-- Enable RLS
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_applications ENABLE ROW LEVEL SECURITY;

-- Opportunities RLS
CREATE POLICY "Anyone can view active opportunities" ON public.opportunities
  FOR SELECT USING (is_active = true AND is_approved = true);

CREATE POLICY "Users can create opportunities" ON public.opportunities
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their opportunities" ON public.opportunities
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their opportunities" ON public.opportunities
  FOR DELETE USING (auth.uid() = creator_id);

CREATE POLICY "Creators can view their own drafts" ON public.opportunities
  FOR SELECT USING (auth.uid() = creator_id);

-- Applications RLS
CREATE POLICY "Users can submit applications" ON public.opportunity_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own applications" ON public.opportunity_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Opportunity creators can view applications" ON public.opportunity_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.opportunities 
      WHERE opportunities.id = opportunity_applications.opportunity_id 
      AND opportunities.creator_id = auth.uid()
    )
  );

CREATE POLICY "Opportunity creators can update application status" ON public.opportunity_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.opportunities 
      WHERE opportunities.id = opportunity_applications.opportunity_id 
      AND opportunities.creator_id = auth.uid()
    )
  );

-- Increment views function
CREATE OR REPLACE FUNCTION public.increment_opportunity_views(opp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.opportunities SET views_count = views_count + 1 WHERE id = opp_id;
END;
$$;

-- Increment applications count function
CREATE OR REPLACE FUNCTION public.increment_opportunity_applications(opp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.opportunities SET applications_count = applications_count + 1 WHERE id = opp_id;
END;
$$;
