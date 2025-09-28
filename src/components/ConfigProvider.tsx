'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';
import { Config } from '@/lib/types';
import { OnboardingProvider } from './onboarding/OnboardingProvider';
import { OnboardingModal } from './onboarding/OnboardingModal';
import { TutorialOverlay } from './onboarding/TutorialOverlay';

interface ConfigContextType {
  config: Config | null;
  loading: boolean;
  updateConfig: (newConfig: Config) => Promise<void>;
  reloadConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  loading: true,
  updateConfig: async () => {},
  reloadConfig: async () => {},
});

export const useConfig = () => useContext(ConfigContext);

export default function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // Initialize with default config
      const defaultConfig: Config = {
        api: {
          apiKey: '',
          secretKey: '',
        },
        symbols: {
          ASTERUSDT: {
            longVolumeThresholdUSDT: 1000,
            shortVolumeThresholdUSDT: 2500,
            tradeSize: 0.69,
            shortTradeSize: 0.69,
            maxPositionMarginUSDT: 200,
            leverage: 10,
            tpPercent: 1,
            slPercent: 20,
            vwapProtection: true,
            vwapTimeframe: "5m",
            vwapLookback: 200
          },
        },
        global: {
          riskPercent: 90,
          paperMode: true,
          positionMode: "HEDGE",
          maxOpenPositions: 5,
          server: {
            dashboardPassword: "",
            dashboardPort: 3000,
            websocketPort: 8080,
            useRemoteWebSocket: false,
            websocketHost: null
          }
        },
        version: "1.1.0"
      };
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (newConfig: Config) => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (response.ok) {
        setConfig(newConfig);
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Listen for tutorial restart event
  useEffect(() => {
    const handleRestartTutorial = () => {
      const event = new CustomEvent('restart-onboarding');
      window.dispatchEvent(event);
    };

    window.addEventListener('restart-tutorial', handleRestartTutorial);
    return () => window.removeEventListener('restart-tutorial', handleRestartTutorial);
  }, []);

  return (
    <ConfigContext.Provider
      value={{
        config,
        loading,
        updateConfig,
        reloadConfig: loadConfig,
      }}
    >
      <OnboardingProvider>
        {children}
        <OnboardingModal />
        <TutorialOverlay />
      </OnboardingProvider>
    </ConfigContext.Provider>
  );
}