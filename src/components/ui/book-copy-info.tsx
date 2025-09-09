import { InfoIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface BookCopyInfoProps {
  variant?: "compact" | "full";
}

export function BookCopyInfo({ variant = "compact" }: BookCopyInfoProps) {
  const [expanded, setExpanded] = useState(false);
  
  if (variant === "compact" && !expanded) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <InfoIcon className="h-4 w-4 text-blue-500" />
        <span>Book copies are used for physical tracking.</span>
        <Button 
          variant="link" 
          className="p-0 h-auto text-xs text-blue-500" 
          onClick={() => setExpanded(true)}
        >
          Learn more
        </Button>
      </div>
    );
  }
  
  return (
    <Card className="mb-4 bg-blue-50/50 border-blue-100">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start gap-3">
          <InfoIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-blue-900">About Book Copies and System IDs</p>
            <p className="text-blue-800">
              Each physical book in the library is represented as a <strong>book copy</strong> with its own unique <strong>system ID</strong>.
            </p>
            <ul className="list-disc pl-5 text-blue-700 space-y-1">
              <li>Book copies track the physical state and availability of each book</li>
              <li>System IDs (tracking codes) are used for scanning and database identification</li>
              <li>When borrowing or returning books, you'll work primarily with the copy number</li>
            </ul>
            {variant === "compact" && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs mt-1 h-7 text-blue-700" 
                onClick={() => setExpanded(false)}
              >
                Show less
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 