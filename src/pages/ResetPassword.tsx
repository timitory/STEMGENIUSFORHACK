import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { toast } from "sonner";
import { z } from "zod";

const resetPasswordSchema = z.object({
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    // Check if we have the access_token and type=recovery in URL
    const accessToken = searchParams.get('access_token');
    const type = searchParams.get('type');

    if (type === 'recovery' && accessToken) {
      // Set the session with the recovery token
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: searchParams.get('refresh_token') || '',
      });
    }
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validatedData = resetPasswordSchema.parse(formData);

      const { error } = await supabase.auth.updateUser({
        password: validatedData.password
      });

      if (error) throw error;

      toast.success("Password updated successfully! You can now sign in with your new password.");
      navigate("/auth");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to reset password");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="p-6">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Reset Your Password</h1>
            <p className="text-muted-foreground mt-2">
              Enter your new password below
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating password..." : "Update Password"}
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="link"
              onClick={() => navigate("/auth")}
              className="text-sm"
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </Card>
    </AuthLayout>
  );
}