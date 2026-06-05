"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const TERMS_VERSION = "v1";

type ConnectDbDialogProps = {
  specId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
};

export function ConnectDbDialog({
  specId,
  open,
  onOpenChange,
  onConnected,
}: ConnectDbDialogProps) {
  const [label, setLabel] = useState("My database");
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/db/defaults")
      .then((res) => res.json())
      .then((data: {
        defaults?: {
          label?: string;
          host?: string;
          port?: number;
          database?: string;
          username?: string;
          password?: string;
        } | null;
      }) => {
        const d = data.defaults;
        if (!d) return;
        if (d.label) setLabel(d.label);
        if (d.host) setHost(d.host);
        if (d.port) setPort(String(d.port));
        if (d.database) setDatabase(d.database);
        if (d.username) setUsername(d.username);
        if (d.password) setPassword(d.password);
      })
      .catch(() => undefined);
  }, [open]);

  const handleSave = async () => {
    if (!accepted) {
      toast.error("Accept the terms to continue");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/db/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specId,
          label,
          host,
          port: Number(port) || 5432,
          database,
          username,
          password,
          acceptedTerms: true,
          termsVersion: TERMS_VERSION,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.success("Database connected");
      onConnected();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect PostgreSQL</DialogTitle>
          <DialogDescription>
            Read-only access for schema-aware Q&A and payload suggestions.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="border-warning/40 bg-warning/10 text-warning">
          <AlertTitle>Security notice</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>
              Credentials are stored encrypted on this server. Schema and small
              samples may be sent to your AI provider — never your password.
            </p>
            <p>
              Playground API keys are separate. Use a read-only DB user with
              minimal table access.
            </p>
          </AlertDescription>
        </Alert>

        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="db-label">Label</Label>
            <Input id="db-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="db-host">Host</Label>
              <Input id="db-host" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="db-port">Port</Label>
              <Input id="db-port" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="db-name">Database</Label>
            <Input id="db-name" value={database} onChange={(e) => setDatabase(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="db-user">Username</Label>
            <Input id="db-user" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="db-pass">Password</Label>
            <Input
              id="db-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="db-terms"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
          />
          <label htmlFor="db-terms" className="text-xs text-muted-foreground leading-snug">
            I accept the{" "}
            <Link href="/db-connection-terms.md" className="underline" target="_blank">
              Database Connection Terms ({TERMS_VERSION})
            </Link>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !accepted}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
