import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface LeadCaptureModalProps {
  open: boolean;
  onSuccess: (lead: { firstName: string; lastName: string }) => void;
  onOpenChange: (open: boolean) => void;
}

export default function LeadCaptureModal({
  open,
  onSuccess,
  onOpenChange,
}: LeadCaptureModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tcpa, setTcpa] = useState(false);
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    tcpa?: string;
  }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required.";
    if (!lastName.trim()) newErrors.lastName = "Last name is required.";
    if (!tcpa) newErrors.tcpa = "You must agree to be contacted.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    onSuccess({ firstName: firstName.trim(), lastName: lastName.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl">Unlock Your Free Worksheet</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            See exactly how much you could save — personalized numbers, no credit check, no
            commitment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-sm font-medium">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="Jane"
                value={firstName}
                autoFocus
                className="h-11"
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors((p) => ({ ...p, firstName: undefined }));
                }}
              />
              {errors.firstName && (
                <p className="text-destructive text-xs">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-sm font-medium">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                placeholder="Smith"
                value={lastName}
                className="h-11"
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) setErrors((p) => ({ ...p, lastName: undefined }));
                }}
              />
              {errors.lastName && (
                <p className="text-destructive text-xs">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <Checkbox
                id="tcpa"
                checked={tcpa}
                onCheckedChange={(checked) => {
                  setTcpa(checked === true);
                  if (errors.tcpa) setErrors((p) => ({ ...p, tcpa: undefined }));
                }}
              />
              <Label
                htmlFor="tcpa"
                className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
              >
                By checking this box I agree to be contacted by Mykoal DeShazo / Adaxa Home LLC
                via phone, email, or text (including automated means) regarding mortgage products.
                I understand consent is not required to obtain services. Message and data rates may
                apply.
              </Label>
            </div>
            {errors.tcpa && (
              <p className="text-destructive text-xs pl-6">{errors.tcpa}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold text-base"
          >
            View My Worksheet →
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Licensed in AZ, CO, TX, FL, OR, WA, MN, MI, PA · NMLS #1912347
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
