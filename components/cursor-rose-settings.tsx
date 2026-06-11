"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCursorRoseSettings } from "@/hooks/use-cursor-rose-settings";
import { hexToRgba } from "@/lib/cursor-rose-settings";

export function CursorRoseSettingsButton() {
  const { settings, setSettings } = useCursorRoseSettings();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 hover:bg-muted"
          aria-label="Customize cursor circle"
        >
          <span
            className="size-5 rounded-full"
            style={{
              backgroundColor: hexToRgba(settings.color, settings.opacity),
              opacity: settings.enabled ? 1 : 0.35,
            }}
            aria-hidden
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>Cursor circle</PopoverTitle>
          <PopoverDescription>
            Customize the circle that follows your cursor.
          </PopoverDescription>
        </PopoverHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor="cursor-rose-enabled"
              className="text-sm font-normal cursor-pointer"
            >
              Show circle
            </Label>
            <Checkbox
              id="cursor-rose-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings({ enabled: checked === true })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cursor-rose-color" className="text-sm">
              Color
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="cursor-rose-color"
                type="color"
                value={settings.color}
                onChange={(e) => setSettings({ color: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                disabled={!settings.enabled}
              />
              <span className="text-xs font-mono text-muted-foreground">
                {settings.color}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="cursor-rose-opacity" className="text-sm">
                Opacity
              </Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {settings.opacity}%
              </span>
            </div>
            <input
              id="cursor-rose-opacity"
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.opacity}
              onChange={(e) =>
                setSettings({ opacity: Number(e.target.value) })
              }
              disabled={!settings.enabled}
              className="w-full accent-primary disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-center pt-1">
            <div
              className="size-10 rounded-full"
              style={{
                backgroundColor: hexToRgba(settings.color, settings.opacity),
                opacity: settings.enabled ? 1 : 0.35,
              }}
              aria-hidden
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
