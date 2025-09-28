'use client';

import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Flame, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import websocketService from '@/lib/services/websocketService';
import { gsap } from 'gsap';

interface LiquidationEvent {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  quantity: number;
  price: number;
  averagePrice: number;
  orderStatus: string;
  eventTime: number;
  timestamp: Date;

  // Computed fields
  volume: number;
  isHighVolume: boolean;
}

interface LiquidationSidebarProps {
  volumeThresholds?: Record<string, number>;
  maxEvents?: number;
}

export default function LiquidationSidebar({ volumeThresholds = {}, maxEvents = 10 }: LiquidationSidebarProps) {
  const [events, setEvents] = useState<LiquidationEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const _containerRef = useRef<HTMLDivElement>(null);
  const prevEventsRef = useRef<LiquidationEvent[]>([]);

  // Load historical liquidations on mount
  useEffect(() => {
    const loadHistoricalLiquidations = async () => {
      try {
        const response = await fetch(`/api/liquidations?limit=${maxEvents}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const historicalEvents = result.data.map((liq: any) => {
              const volume = liq.volume_usdt || (liq.quantity * liq.price);
              const threshold = volumeThresholds[liq.symbol] || 10000;
              return {
                symbol: liq.symbol,
                side: liq.side,
                orderType: liq.order_type,
                quantity: liq.quantity,
                price: liq.price,
                averagePrice: liq.average_price || liq.price,
                orderStatus: liq.order_status,
                eventTime: liq.event_time,
                timestamp: new Date(liq.event_time),
                volume,
                isHighVolume: volume >= threshold,
              };
            });
            console.log(`Loaded ${historicalEvents.length} historical liquidations`);
            setEvents(historicalEvents);
          }
        }
      } catch (error) {
        console.error('Failed to load historical liquidations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistoricalLiquidations();
  }, []); // Only run once on mount

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'liquidation') {
        const liquidationData = message.data;

        // Calculate volume and determine if high volume
        const volume = liquidationData.quantity * liquidationData.price;
        const threshold = volumeThresholds[liquidationData.symbol] || 10000; // Default $10k
        const isHighVolume = volume >= threshold;

        const liquidationEvent: LiquidationEvent = {
          ...liquidationData,
          volume,
          isHighVolume,
        };

        // Mark this event as new for animation
        const eventId = `${liquidationData.symbol}-${liquidationData.eventTime}`;
        setNewEventIds(prev => new Set([...prev, eventId]));

        setEvents(prev => {
          const newEvents = [liquidationEvent, ...prev].slice(0, maxEvents);
          prevEventsRef.current = newEvents;
          return newEvents;
        });

        // Remove the new event marker after animation
        setTimeout(() => {
          setNewEventIds(prev => {
            const updated = new Set(prev);
            updated.delete(eventId);
            return updated;
          });
        }, 2000);
      }
    };

    // Handle connection status changes
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
    };

    // Set up WebSocket service handlers
    const cleanupMessageHandler = websocketService.addMessageHandler(handleMessage);
    const cleanupConnectionListener = websocketService.addConnectionListener(handleConnectionChange);

    return () => {
      cleanupMessageHandler();
      cleanupConnectionListener();
    };
  }, [volumeThresholds, maxEvents]);

  const formatTime = (timestamp: Date | number): string => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    }
    return `$${volume.toFixed(0)}`;
  };


  const getVolumeColor = (volume: number): string => {
    if (volume >= 5000000) return 'bg-yellow-500/30 text-yellow-300 border border-yellow-400/60 shadow-lg shadow-yellow-500/20'; // $5M+
    if (volume >= 1000000) return 'bg-orange-500/25 text-orange-300 border border-orange-400/50 shadow-md shadow-orange-500/15'; // $1M+
    if (volume >= 500000) return 'bg-orange-500/20 text-orange-400 border border-orange-400/40'; // $500K+
    if (volume >= 250000) return 'bg-blue-500/20 text-blue-300 border border-blue-400/40'; // $250K+
    if (volume >= 100000) return 'bg-purple-500/15 text-purple-400 border border-purple-400/30'; // $100K+
    if (volume >= 50000) return 'bg-purple-500/10 text-purple-400/90 border border-purple-400/20'; // $50K+
    return 'bg-muted/50 text-muted-foreground/70 border border-border/50'; // < $50K
  };

  const getLiquidationIntensity = (volume: number): { bgIntensity: number; scale: string; glow: string; borderWidth: string } => {
    if (volume >= 5000000) return { bgIntensity: 25, scale: 'scale-100', glow: 'shadow-lg', borderWidth: '4px' };
    if (volume >= 1000000) return { bgIntensity: 20, scale: 'scale-100', glow: 'shadow-md', borderWidth: '3px' };
    if (volume >= 500000) return { bgIntensity: 15, scale: 'scale-100', glow: 'shadow-sm', borderWidth: '3px' };
    if (volume >= 250000) return { bgIntensity: 12, scale: 'scale-100', glow: '', borderWidth: '2px' };
    if (volume >= 100000) return { bgIntensity: 10, scale: 'scale-95', glow: '', borderWidth: '2px' };
    if (volume >= 50000) return { bgIntensity: 8, scale: 'scale-95', glow: '', borderWidth: '2px' };
    if (volume >= 10000) return { bgIntensity: 5, scale: 'scale-90', glow: '', borderWidth: '1px' };
    return { bgIntensity: 3, scale: 'scale-90', glow: '', borderWidth: '1px' };
  };

  return (
    <div className="w-72 border-l bg-card/50 backdrop-blur-sm hidden lg:block h-full overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="border-b p-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Liquidations</h3>
            <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1 text-xs h-5">
              <Activity className={`h-2 w-2 ${isConnected ? 'animate-pulse' : ''}`} />
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))
          ) : events.length > 0 ? (
            events.map((event, _index) => {
              const eventId = `${event.symbol}-${event.eventTime}`;
              const isNew = newEventIds.has(eventId);
              const _volumeColor = getVolumeColor(event.volume);
              const intensity = getLiquidationIntensity(event.volume);
              // SELL liquidation = Longs getting liquidated (should be GREEN - they were bullish)
              // BUY liquidation = Shorts getting liquidated (should be RED - they were bearish)
              const isLongLiquidation = event.side === 'SELL';
              const positionType = isLongLiquidation ? 'LONG' : 'SHORT';

              // Dynamic background intensity based on volume
              const bgOpacity = intensity.bgIntensity;
              const bgColor = isLongLiquidation
                ? `${intensity.glow} ${event.volume >= 100000 ? 'shadow-green-500/20' : ''}`
                : `${intensity.glow} ${event.volume >= 100000 ? 'shadow-red-500/20' : ''}`;

              // Text colors remain fully readable
              const textColor = isLongLiquidation ? 'text-green-400' : 'text-red-400';
              const iconColor = isLongLiquidation ? 'text-green-500' : 'text-red-500';

              return (
                <LiquidationItem
                  key={eventId}
                  event={event}
                  isNew={isNew}
                  isLongLiquidation={isLongLiquidation}
                  positionType={positionType}
                  bgColor={bgColor}
                  bgOpacity={bgOpacity}
                  intensity={intensity}
                  textColor={textColor}
                  iconColor={iconColor}
                  volumeColor={getVolumeColor(event.volume)}
                  formatVolume={formatVolume}
                  formatTime={formatTime}
                />
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No liquidations yet...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Separate component for animated liquidation items
function LiquidationItem({
  event,
  isNew,
  isLongLiquidation,
  positionType,
  bgColor,
  bgOpacity,
  intensity,
  textColor,
  iconColor,
  volumeColor,
  formatVolume,
  formatTime,
}: {
  event: LiquidationEvent;
  isNew: boolean;
  isLongLiquidation: boolean;
  positionType: string;
  bgColor: string;
  bgOpacity: number;
  intensity: any;
  textColor: string;
  iconColor: string;
  volumeColor: string;
  formatVolume: (volume: number) => string;
  formatTime: (timestamp: Date | number) => string;
}) {
  const itemRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (isNew && itemRef.current) {
      const element = itemRef.current;

      // Choose animation based on volume
      if (event.volume >= 5000000) {
        // Mega liquidation - explosive entrance with neon wave effect
        gsap.fromTo(element,
          {
            scale: 0,
            opacity: 0,
            rotationY: 180,
            x: 100,
          },
          {
            scale: 1,
            opacity: 1,
            rotationY: 0,
            x: 0,
            duration: 0.8,
            ease: "elastic.out(1, 0.5)",
            onComplete: () => {
              // Neon wave effect - create a traveling wave across the card
              const waveTimeline = gsap.timeline();

              // Create wave effect with multiple gradient positions
              waveTimeline
                .to(element, {
                  background: isLongLiquidation
                    ? "linear-gradient(90deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.8) 20%, rgba(34,197,94,0.9) 40%, rgba(34,197,94,0.8) 60%, rgba(34,197,94,0.1) 100%)"
                    : "linear-gradient(90deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.8) 20%, rgba(239,68,68,0.9) 40%, rgba(239,68,68,0.8) 60%, rgba(239,68,68,0.1) 100%)",
                  duration: 0.3,
                  ease: "power2.inOut"
                })
                .to(element, {
                  background: isLongLiquidation
                    ? "linear-gradient(90deg, rgba(34,197,94,0.1) 20%, rgba(34,197,94,0.9) 40%, rgba(34,197,94,1) 60%, rgba(34,197,94,0.9) 80%, rgba(34,197,94,0.1) 100%)"
                    : "linear-gradient(90deg, rgba(239,68,68,0.1) 20%, rgba(239,68,68,0.9) 40%, rgba(239,68,68,1) 60%, rgba(239,68,68,0.9) 80%, rgba(239,68,68,0.1) 100%)",
                  duration: 0.3,
                  ease: "power2.inOut"
                })
                .to(element, {
                  background: isLongLiquidation
                    ? "linear-gradient(90deg, rgba(34,197,94,0.1) 40%, rgba(34,197,94,0.8) 60%, rgba(34,197,94,0.9) 80%, rgba(34,197,94,0.8) 100%, rgba(34,197,94,0.1) 120%)"
                    : "linear-gradient(90deg, rgba(239,68,68,0.1) 40%, rgba(239,68,68,0.8) 60%, rgba(239,68,68,0.9) 80%, rgba(239,68,68,0.8) 100%, rgba(239,68,68,0.1) 120%)",
                  duration: 0.3,
                  ease: "power2.inOut"
                })
                .to(element, {
                  backgroundColor: isLongLiquidation ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
                  duration: 0.4,
                  ease: "power2.out"
                });

              // Add intense pulsing glow
              gsap.to(element, {
                boxShadow: isLongLiquidation
                  ? "0 0 40px rgba(34, 197, 94, 0.8), 0 0 20px rgba(34, 197, 94, 0.6)"
                  : "0 0 40px rgba(239, 68, 68, 0.8), 0 0 20px rgba(239, 68, 68, 0.6)",
                duration: 0.6,
                yoyo: true,
                repeat: 5,
                ease: "power2.inOut"
              });

              // Breathing effect that continues
              gsap.to(element, {
                scale: 1.02,
                duration: 1.5,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
                delay: 1.5
              });
            }
          }
        );
      } else if (event.volume >= 1000000) {
        // Large liquidation - enhanced bounce with strong pulse
        gsap.fromTo(element,
          {
            y: -50,
            opacity: 0,
            scale: 1.5,
          },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            ease: "bounce.out",
            onComplete: () => {
              // Enhanced pulsing effect
              const pulseTimeline = gsap.timeline();

              pulseTimeline
                .to(element, {
                  scale: 1.08,
                  backgroundColor: isLongLiquidation
                    ? "rgba(34, 197, 94, 0.5)"
                    : "rgba(239, 68, 68, 0.5)",
                  boxShadow: isLongLiquidation
                    ? "0 0 25px rgba(34, 197, 94, 0.6)"
                    : "0 0 25px rgba(239, 68, 68, 0.6)",
                  duration: 0.3,
                  ease: "power2.out"
                })
                .to(element, {
                  scale: 0.98,
                  backgroundColor: isLongLiquidation
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(239, 68, 68, 0.2)",
                  boxShadow: isLongLiquidation
                    ? "0 0 10px rgba(34, 197, 94, 0.3)"
                    : "0 0 10px rgba(239, 68, 68, 0.3)",
                  duration: 0.4,
                  ease: "power2.inOut"
                })
                .to(element, {
                  scale: 1.05,
                  backgroundColor: isLongLiquidation
                    ? "rgba(34, 197, 94, 0.35)"
                    : "rgba(239, 68, 68, 0.35)",
                  boxShadow: isLongLiquidation
                    ? "0 0 20px rgba(34, 197, 94, 0.5)"
                    : "0 0 20px rgba(239, 68, 68, 0.5)",
                  duration: 0.3,
                  ease: "power2.out"
                })
                .to(element, {
                  scale: 1,
                  backgroundColor: isLongLiquidation
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(239, 68, 68, 0.2)",
                  boxShadow: "none",
                  duration: 0.5,
                  ease: "power2.out"
                });

              // Subtle continuing pulse
              gsap.to(element, {
                scale: 1.01,
                duration: 2,
                yoyo: true,
                repeat: 3,
                ease: "sine.inOut",
                delay: 1.5
              });
            }
          }
        );
      } else if (event.volume >= 500000) {
        // Medium liquidation - slide and zoom with gentle pulse
        gsap.fromTo(element,
          {
            x: 300,
            opacity: 0,
            scale: 0.5,
          },
          {
            x: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: "power3.out",
            onComplete: () => {
              // Gentle pulse for medium liquidations
              gsap.to(element, {
                scale: 1.03,
                backgroundColor: isLongLiquidation
                  ? "rgba(34, 197, 94, 0.3)"
                  : "rgba(239, 68, 68, 0.3)",
                duration: 0.4,
                yoyo: true,
                repeat: 1,
                ease: "power2.inOut"
              });
            }
          }
        );
      } else if (event.volume >= 100000) {
        // Significant liquidation - fade slide
        gsap.fromTo(element,
          {
            x: 100,
            opacity: 0,
          },
          {
            x: 0,
            opacity: 1,
            duration: 0.4,
            ease: "power2.out",
          }
        );
      } else if (event.volume >= 10000) {
        // Notable liquidation ($10K+) - slide in with subtle glow
        gsap.fromTo(element,
          {
            x: 50,
            opacity: 0,
            scale: 0.9,
          },
          {
            x: 0,
            opacity: 1,
            scale: 1,
            duration: 0.35,
            ease: "power2.out",
            onComplete: () => {
              // Subtle highlight effect
              gsap.to(element, {
                backgroundColor: isLongLiquidation
                  ? "rgba(34, 197, 94, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
                boxShadow: isLongLiquidation
                  ? "0 0 8px rgba(34, 197, 94, 0.2)"
                  : "0 0 8px rgba(239, 68, 68, 0.2)",
                duration: 0.3,
                yoyo: true,
                repeat: 1,
                ease: "power2.inOut"
              });
            }
          }
        );
      } else if (event.volume >= 1000) {
        // Small liquidation ($1K+) - gentle slide with micro scale
        gsap.fromTo(element,
          {
            x: 20,
            opacity: 0,
            scale: 0.95,
          },
          {
            x: 0,
            opacity: 1,
            scale: 1,
            duration: 0.25,
            ease: "power1.out",
            onComplete: () => {
              // Very subtle flash
              gsap.to(element, {
                backgroundColor: isLongLiquidation
                  ? "rgba(34, 197, 94, 0.08)"
                  : "rgba(239, 68, 68, 0.08)",
                duration: 0.2,
                yoyo: true,
                repeat: 1,
                ease: "power1.inOut"
              });
            }
          }
        );
      } else {
        // Tiny liquidation - simple fade
        gsap.fromTo(element,
          {
            opacity: 0,
            y: -10,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.3,
            ease: "power1.out",
          }
        );
      }

      // Enhanced shake animation for very large liquidations
      if (event.volume >= 1000000) {
        gsap.to(element, {
          x: "+=3",
          rotation: "+=1",
          duration: 0.08,
          repeat: 7,
          yoyo: true,
          ease: "power1.inOut",
          delay: 0.5
        });
      }
    }
  }, [isNew, event.volume, isLongLiquidation]);

  return (
    <div
      ref={itemRef}
      className={`flex items-center justify-between px-3 py-1.5 border-b transition-all duration-300 ${bgColor} cursor-default hover:brightness-110`}
      style={{
        backgroundColor: isLongLiquidation
          ? `rgb(34 197 94 / ${bgOpacity}%)`
          : `rgb(239 68 68 / ${bgOpacity}%)`,
        borderLeftWidth: intensity.borderWidth,
        borderLeftColor: isLongLiquidation ? 'rgb(34 197 94)' : 'rgb(239 68 68)'
      }}
    >
      <div className="flex items-center gap-1.5 flex-1">
        {event.volume >= 1000000 && (
          <Flame className="h-3 w-3 text-yellow-400 animate-pulse drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]" />
        )}
        {event.volume >= 500000 && event.volume < 1000000 && (
          <AlertTriangle className="h-3 w-3 text-orange-400 animate-pulse" />
        )}
        {isLongLiquidation ? (
          <TrendingDown className={`h-3 w-3 ${iconColor} ${event.volume >= 100000 ? 'drop-shadow-[0_0_2px_rgba(34,197,94,0.4)]' : ''}`} />
        ) : (
          <TrendingUp className={`h-3 w-3 ${iconColor} ${event.volume >= 100000 ? 'drop-shadow-[0_0_2px_rgba(239,68,68,0.4)]' : ''}`} />
        )}
        <div className={`text-xs font-bold ${textColor} w-10 ${event.volume >= 500000 ? 'animate-pulse' : ''}`}>
          {positionType}
        </div>
        <div className={`text-xs transition-all ${
          event.volume >= 1000000 ? 'text-foreground font-bold' :
          event.volume >= 100000 ? 'text-foreground font-medium' :
          'text-foreground/70 font-normal'
        }`}>
          {event.symbol.replace('USDT', '')}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`text-xs font-bold px-1.5 py-0.5 rounded-sm transition-all ${volumeColor} ${intensity.scale}`}>
          {formatVolume(event.volume)}
        </div>
        <div className={`text-[10px] w-8 text-right ${
          event.volume >= 100000 ? 'text-muted-foreground' : 'text-muted-foreground/70'
        }`}>
          {formatTime(event.timestamp)}
        </div>
      </div>
    </div>
  );
}