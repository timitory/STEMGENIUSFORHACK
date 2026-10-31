-- Create notifications table for user notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('achievement', 'quiz', 'social', 'purchase', 'system', 'admin')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb, -- Additional data for the notification
    read BOOLEAN DEFAULT FALSE,
    action_url TEXT, -- URL to navigate to when clicked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- Create function to automatically create notifications for user activities
CREATE OR REPLACE FUNCTION create_user_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB DEFAULT '{}'::jsonb,
    p_action_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, data, action_url)
    VALUES (p_user_id, p_type, p_title, p_message, p_data, p_action_url)
    RETURNING id INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create achievement notifications
CREATE OR REPLACE FUNCTION create_achievement_notification(
    p_user_id UUID,
    p_achievement_type TEXT,
    p_achievement_name TEXT
) RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    achievement_title TEXT;
    achievement_message TEXT;
BEGIN
    achievement_title := 'Achievement Unlocked! 🏆';
    achievement_message := 'Congratulations! You earned the "' || p_achievement_name || '" achievement.';

    SELECT create_user_notification(
        p_user_id,
        'achievement',
        achievement_title,
        achievement_message,
        jsonb_build_object('achievement_type', p_achievement_type, 'achievement_name', p_achievement_name),
        '/leaderboard'
    ) INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create quiz completion notifications
CREATE OR REPLACE FUNCTION create_quiz_completion_notification(
    p_user_id UUID,
    p_quiz_title TEXT,
    p_score INTEGER,
    p_total_questions INTEGER
) RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    score_percentage INTEGER;
    notification_title TEXT;
    notification_message TEXT;
BEGIN
    score_percentage := ROUND((p_score::decimal / p_total_questions::decimal) * 100);

    IF score_percentage >= 90 THEN
        notification_title := 'Outstanding Quiz Performance! 🌟';
        notification_message := 'Amazing! You scored ' || score_percentage || '% on "' || p_quiz_title || '". You''re a quiz master!';
    ELSIF score_percentage >= 80 THEN
        notification_title := 'Great Quiz Results! 🎉';
        notification_message := 'Well done! You scored ' || score_percentage || '% on "' || p_quiz_title || '". Keep it up!';
    ELSIF score_percentage >= 70 THEN
        notification_title := 'Good Job on the Quiz! 👍';
        notification_message := 'Nice work! You scored ' || score_percentage || '% on "' || p_quiz_title || '". Room for improvement!';
    ELSE
        notification_title := 'Quiz Completed 📚';
        notification_message := 'You completed "' || p_quiz_title || '" with a score of ' || score_percentage || '%. Keep practicing!';
    END IF;

    SELECT create_user_notification(
        p_user_id,
        'quiz',
        notification_title,
        notification_message,
        jsonb_build_object('quiz_title', p_quiz_title, 'score', p_score, 'total_questions', p_total_questions, 'percentage', score_percentage),
        '/stem-challenge-arena'
    ) INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create welcome notification for new users
CREATE OR REPLACE FUNCTION create_welcome_notification(p_user_id UUID) RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    SELECT create_user_notification(
        p_user_id,
        'system',
        'Welcome to STEM Genius! 🎓',
        'Welcome aboard! Start your STEM learning journey by exploring our interactive features and challenges.',
        jsonb_build_object('welcome', true),
        '/'
    ) INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create admin broadcast notifications
CREATE OR REPLACE FUNCTION create_admin_broadcast(
    p_title TEXT,
    p_message TEXT,
    p_action_url TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    notification_count INTEGER := 0;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        PERFORM create_user_notification(
            user_record.id,
            'admin',
            p_title,
            p_message,
            jsonb_build_object('broadcast', true, 'admin_message', true),
            p_action_url
        );
        notification_count := notification_count + 1;
    END LOOP;

    RETURN notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.notifications IS 'User notifications for achievements, activities, and system messages';
COMMENT ON COLUMN public.notifications.user_id IS 'Reference to the user who owns this notification';
COMMENT ON COLUMN public.notifications.type IS 'Type of notification: achievement, quiz, social, purchase, system, admin';
COMMENT ON COLUMN public.notifications.title IS 'Short title of the notification';
COMMENT ON COLUMN public.notifications.message IS 'Detailed message content';
COMMENT ON COLUMN public.notifications.data IS 'Additional JSON data related to the notification';
COMMENT ON COLUMN public.notifications.read IS 'Whether the user has read this notification';
COMMENT ON COLUMN public.notifications.action_url IS 'URL to navigate to when the notification is clicked';