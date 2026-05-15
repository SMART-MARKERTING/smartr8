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

interface LeadCaptureModalProps {
  open: boolean;
  onSuccess: (lead: { firstName: string }) => void;
  onOpenChange: (open: boolean) => void;
}

export default function LeadCaptureModal({
  open,
  onSuccess,
  onOpenChange,
}: LeadCaptureModalProps) {
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    setError("");
    onSuccess({ firstName: firstName.trim() });
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
          <div className="space-y-1.5">
            <Label htmlFor="firstName" className="text-sm font-medium">
              What's your first name?
            </Label>
            <Input
              id="firstName"
              placeholder="Jane"
              value={firstName}
              autoFocus
              className="text-base h-11"
              onChange={(e) => {
                setFirstName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as unknown as React.FormEvent)}
            />
            {error && <p className="text-destructive text-xs">{error}</p>}
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
