"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react"

export function MarkdownHelpModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Markdown help">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Markdown Cheatsheet</DialogTitle>
          <DialogDescription>A quick reference for common Markdown syntax.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <h2 className="sr-only">Reference</h2>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Headings</h3>
            <p>
              <code># Heading 1</code>
              <br />
              <code>## Heading 2</code>
              <br />
              <code>### Heading 3</code>
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Emphasis</h3>
            <p>
              <code>*Italic*</code>
              <br />
              <code>**Bold**</code>
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Lists</h3>
            <p>
              Unordered:
              <br />
              <code>- Item 1</code>
              <br />
              <code>- Item 2</code>
              <br />
              Ordered:
              <br />
              <code>1. Item 1</code>
              <br />
              <code>2. Item 2</code>
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Links</h3>
            <p>
              <code>[Link text](URL)</code>
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Code</h3>
            <p>
              Inline: <code>`code`</code>
              <br />
              Block:
              <br />
              <code>```</code>
              <br />
              <code>code block</code>
              <br />
              <code>```</code>
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Images</h3>
            <p>
              <code>![Alt text](Image URL)</code>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
