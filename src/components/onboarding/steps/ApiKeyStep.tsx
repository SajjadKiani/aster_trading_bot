import React, { useState } from 'react';
import { Key, ExternalLink, Copy, Check, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ApiKeyStepProps {
  onNext: (apiKey: string, secretKey: string) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function ApiKeyStep({ onNext, onBack }: ApiKeyStepProps) {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = () => {
    onNext(apiKey, secretKey);
  };

  const handlePaperMode = () => {
    onNext('', '');
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Key className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Connect Your Exchange Account</h2>
        <p className="text-muted-foreground">
          Set up API access to start trading or use Paper Mode for testing
        </p>
      </div>

      <Tabs defaultValue="guide" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="guide">Setup Guide</TabsTrigger>
          <TabsTrigger value="keys">Enter Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="space-y-4">
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Step 1: Create or Access Your Account</h3>
                <Badge variant="outline">Required</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                You need an AsterDex account to get API keys
              </p>
              <Button
                variant="default"
                className="w-full"
                onClick={() => window.open('https://www.asterdex.com/en/referral/3TixB2', '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open AsterDex (Sign Up / API Management)
              </Button>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Step 2: Create API Key</h3>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2">
                  <span className="text-primary font-semibold">1.</span>
                  Click &quot;Create API&quot; button on the page
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-semibold">2.</span>
                  Give your API a memorable label (e.g., &quot;Liquidation Hunter Bot&quot;)
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-semibold">3.</span>
                  Optional: Set IP whitelist for enhanced security
                </li>
              </ol>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Step 3: Copy Your Keys</h3>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Copy both keys immediately. The secret key won&apos;t be shown again!
                </AlertDescription>
              </Alert>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>After creation, you&apos;ll see:</p>
                <ul className="space-y-1">
                  <li>• <strong>API Key:</strong> A 64-character string</li>
                  <li>• <strong>Secret Key:</strong> Another 64-character string (shown only once)</li>
                </ul>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                const tabsList = document.querySelector('[role="tablist"]');
                const keysTab = tabsList?.querySelector('[value="keys"]') as HTMLButtonElement;
                keysTab?.click();
              }}
            >
              I Have My Keys <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="keys" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your 64-character API key"
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => handleCopy(apiKey, 'api')}
                  disabled={!apiKey}
                >
                  {copied === 'api' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {apiKey && apiKey.length !== 64 && (
                <p className="text-xs text-yellow-500">API keys are typically 64 characters long</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretKey">Secret Key</Label>
              <div className="relative">
                <Input
                  id="secretKey"
                  type={showSecretKey ? 'text' : 'password'}
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Paste your 64-character secret key"
                  className="font-mono text-sm pr-20"
                />
                <div className="absolute right-0 top-0 h-full flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-full px-3 hover:bg-transparent"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                  >
                    {showSecretKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-full px-3 hover:bg-transparent"
                    onClick={() => handleCopy(secretKey, 'secret')}
                    disabled={!secretKey}
                  >
                    {copied === 'secret' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {secretKey && secretKey.length !== 64 && (
                <p className="text-xs text-yellow-500">Secret keys are typically 64 characters long</p>
              )}
              <p className="text-xs text-muted-foreground">
                Your secret key is stored locally and never shared
              </p>
            </div>

            <Alert className="bg-muted/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Paper Mode Available:</strong> You can skip this step and test the bot without real trading.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button
              variant="outline"
              onClick={handlePaperMode}
              className="flex-1"
            >
              Use Paper Mode
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!apiKey || !secretKey}
              className="flex-1"
            >
              {apiKey && secretKey ? 'Continue' : 'Enter Keys'}
            </Button>
          </div>

          <div className="flex justify-center">
            {!apiKey && !secretKey ? (
              <Badge variant="secondary">Paper Mode Available</Badge>
            ) : (
              <Badge variant="default">Live Trading Ready</Badge>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}