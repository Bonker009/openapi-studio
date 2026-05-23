import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XCircle, KeyRound } from "lucide-react";

export interface AuthManagerProps {
  authOptions: Record<string, string>;
  activeAuthOption: string | null;
  setActiveAuthOption: React.Dispatch<React.SetStateAction<string | null>>;
  requestHeaders: Record<string, string>;
  setRequestHeaders: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  saveAuthOptions: (options: Record<string, string>) => void;
}

export function AuthManager({
  authOptions,
  activeAuthOption,
  setActiveAuthOption,
  requestHeaders,
  setRequestHeaders,
  saveAuthOptions,
}: AuthManagerProps) {
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenValue, setNewTokenValue] = useState("");

  const addAuthToken = () => {
    if (!newTokenName.trim() || !newTokenValue.trim()) return;

    const updatedOptions = { ...authOptions, [newTokenName]: newTokenValue };
    saveAuthOptions(updatedOptions);

    // Reset inputs
    setNewTokenName("");
    setNewTokenValue("");
  };

  const removeAuthToken = (name: string) => {
    const updatedOptions = { ...authOptions };
    delete updatedOptions[name];
    saveAuthOptions(updatedOptions);

    if (activeAuthOption === name) {
      applyAuthToken(null);
    }
  };

  const applyAuthToken = (name: string | null) => {
    setActiveAuthOption(name);

    // First remove any existing auth headers
    const newHeaders = { ...requestHeaders };
    delete newHeaders["Authorization"];

    // Add the selected auth token if one is selected
    if (name && authOptions[name]) {
      newHeaders["Authorization"] = `Bearer ${authOptions[name]}`;
    }

    setRequestHeaders(newHeaders);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <KeyRound className="h-4 w-4 mr-2" />
          Authorization Manager
        </CardTitle>
        <CardDescription>
          Manage and apply authentication tokens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Auth tokens list */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Stored Auth Tokens</h3>
            {Object.keys(authOptions).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(authOptions).map(([name, token]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div>
                      <div className="font-medium">{name}</div>
                      <div className="text-xs text-muted-foreground">
                        {token.substring(0, 8)}...
                        {token.substring(Math.max(0, token.length - 8))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={
                          activeAuthOption === name ? "border-red-500" : ""
                        }
                        onClick={() => applyAuthToken(name)}
                      >
                        {activeAuthOption === name ? "Applied" : "Use"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-red-400 hover:bg-destructive text-white"
                        onClick={() => removeAuthToken(name)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {activeAuthOption && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-red-400 hover:bg-red-300 text-white hover:text-white"
                    onClick={() => applyAuthToken(null)}
                  >
                    Clear Auth Token
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No stored tokens</p>
            )}
          </div>

          {/* Add new auth token */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-2">Add New Auth Token</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                placeholder="Token name"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
              <Input
                placeholder="Token value"
                value={newTokenValue}
                onChange={(e) => setNewTokenValue(e.target.value)}
                className="md:col-span-2"
              />
            </div>
            <Button
              className="mt-2 bg-red-400 hover:bg-destructive"
              size="sm"
              onClick={addAuthToken}
              disabled={!newTokenName.trim() || !newTokenValue.trim()}
            >
              Add Token
            </Button>
          </div>

          {/* Current token indicator */}
          {activeAuthOption && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Current Active Token</div>
                <Badge className="bg-blue-100 text-blue-800">
                  {activeAuthOption}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This token will be included as a Bearer token in your request
                headers
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
