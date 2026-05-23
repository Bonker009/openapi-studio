"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MultipartBodyState, MultipartFieldRow } from "@/lib/playground/build-form-data";
import { cn } from "@/lib/utils";

type MultipartBodyEditorProps = {
  state: MultipartBodyState;
  onChange: (state: MultipartBodyState) => void;
};

function newRowId(): string {
  return `extra-${Math.random().toString(36).slice(2, 9)}`;
}

function FileFieldRow({
  row,
  onUpdate,
  onRemove,
  canRemove,
}: {
  row: MultipartFieldRow;
  onUpdate: (patch: Partial<MultipartFieldRow>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (row.file?.type.startsWith("image/")) {
      const url = URL.createObjectURL(row.file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
    return undefined;
  }, [row.file]);

  const onFileChange = (files: FileList | null) => {
    const file = files?.[0] ?? null;
    onUpdate({ file });
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
      <div className="flex items-start gap-2">
        {row.fromSchema ? (
          <Label className="text-xs font-medium flex-1 min-w-0 pt-1.5">
            {row.key}
            {row.required && <span className="text-destructive ml-0.5">*</span>}
            <span className="text-muted-foreground font-normal ml-1">(file)</span>
          </Label>
        ) : (
          <Input
            id={`multipart-field-${row.key || "custom"}`}
            value={row.key}
            onChange={(e) => onUpdate({ key: e.target.value })}
            placeholder="Field name"
            className="h-8 font-mono text-sm flex-1"
            aria-label="Custom field name"
          />
        )}
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onRemove}
            aria-label="Remove field"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {row.file ? "Change file" : "Choose file"}
        </Button>
        {row.file && (
          <>
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
              {row.file.name} ({(row.file.size / 1024).toFixed(1)} KB)
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUpdate({ file: null })}
              aria-label="Clear file"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
      {preview && (
        <img
          src={preview}
          alt=""
          className="max-h-24 rounded border border-border object-contain"
        />
      )}
    </div>
  );
}

export function MultipartBodyEditor({ state, onChange }: MultipartBodyEditorProps) {
  const updateRow = useCallback(
    (id: string, patch: Partial<MultipartFieldRow>) => {
      onChange({
        rows: state.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      });
    },
    [state.rows, onChange]
  );

  const removeRow = useCallback(
    (id: string) => {
      onChange({ rows: state.rows.filter((r) => r.id !== id) });
    },
    [state.rows, onChange]
  );

  const addField = (type: "text" | "file") => {
    onChange({
      rows: [
        ...state.rows,
        {
          id: newRowId(),
          key: "",
          type,
          textValue: "",
          file: null,
          fromSchema: false,
        },
      ],
    });
  };

  if (state.rows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          No form fields defined in the OpenAPI schema. Add fields below.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => addField("file")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add file field
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => addField("text")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add text field
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state.rows.map((row) =>
        row.type === "file" ? (
          <FileFieldRow
            key={row.id}
            row={row}
            onUpdate={(patch) => updateRow(row.id, patch)}
            onRemove={() => removeRow(row.id)}
            canRemove={!row.fromSchema || !row.required}
          />
        ) : (
          <div
            key={row.id}
            className="rounded-lg border border-border p-3 space-y-2 bg-card"
          >
            <div className="flex items-start gap-2">
              {row.fromSchema ? (
                <Label className="text-xs font-medium flex-1 min-w-0 pt-1.5">
                  {row.key}
                  {row.required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </Label>
              ) : (
                <Input
                  value={row.key}
                  onChange={(e) => updateRow(row.id, { key: e.target.value })}
                  placeholder="Field name"
                  className="h-8 font-mono text-sm flex-1"
                />
              )}
              {!row.fromSchema && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeRow(row.id)}
                  aria-label="Remove field"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <Input
              value={row.textValue}
              onChange={(e) => updateRow(row.id, { textValue: e.target.value })}
              className="h-8 font-mono text-sm"
              placeholder="Value"
            />
          </div>
        )
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => addField("text")}
        >
          <Plus className="h-3.5 w-3.5" />
          Add field
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 text-xs gap-1")}
          onClick={() => addField("file")}
        >
          <Plus className="h-3.5 w-3.5" />
          Add file field
        </Button>
      </div>
    </div>
  );
}
