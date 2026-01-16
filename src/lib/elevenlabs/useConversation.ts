"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ConversationConfigOverride } from './types';

export type ConversationState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface UseConversationOptions {
  onMessage?: (message: string, role: 'agent' | 'user') => void;
  onStateChange?: (state: ConversationState) => void;
  onError?: (error: Error) => void;
  onConversationStarted?: (conversationId: string) => void;
}

interface ConnectOptions {
  signedUrl: string;
  configOverride?: ConversationConfigOverride;
}

interface UseConversationReturn {
  state: ConversationState;
  conversationId: string | null;
  connect: (options: ConnectOptions) => Promise<void>;
  disconnect: () => void;
  mute: () => void;
  unmute: () => void;
  isMuted: boolean;
  error: Error | null;
}

/**
 * React hook for managing ElevenLabs conversation WebSocket connection
 */
export function useConversation(options: UseConversationOptions = {}): UseConversationReturn {
  const { onMessage, onStateChange, onError, onConversationStarted } = options;

  const [state, setState] = useState<ConversationState>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const updateState = useCallback((newState: ConversationState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  const cleanup = useCallback(() => {
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(async (options: ConnectOptions) => {
    const { signedUrl, configOverride } = options;

    if (state === 'connected' || state === 'connecting') {
      return;
    }

    updateState('connecting');
    setError(null);

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      mediaStreamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Create WebSocket connection
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send conversation initiation data with overrides before anything else
        if (configOverride) {
          ws.send(JSON.stringify({
            type: 'conversation_initiation_client_data',
            conversation_config_override: configOverride,
          }));
        }

        updateState('connected');

        // Set up audio processing
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && !isMuted) {
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert to 16-bit PCM
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }
            ws.send(pcmData.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      ws.onmessage = async (event) => {
        try {
          if (event.data instanceof Blob) {
            // Audio data from agent - play it
            const arrayBuffer = await event.data.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
          } else {
            // JSON message
            const message = JSON.parse(event.data);

            if (message.type === 'conversation_initiation_metadata') {
              // ElevenLabs sends this after connection with the conversation_id
              const convId = message.conversation_id;
              if (convId) {
                console.log('Conversation started with ID:', convId);
                setConversationId(convId);
                onConversationStarted?.(convId);
              }
            } else if (message.type === 'transcript') {
              onMessage?.(message.text, message.role);
            } else if (message.type === 'conversation_ended') {
              updateState('ended');
            } else if (message.type === 'error' || message.type === 'fatal_error') {
              console.error('ElevenLabs conversation error:', message);
              const err = new Error(message.message || message.error || 'Conversation error');
              setError(err);
              onError?.(err);
              updateState('error');
            }
          }
        } catch (err) {
          console.error('Error processing message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        const err = new Error('WebSocket connection error');
        setError(err);
        onError?.(err);
        updateState('error');
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}, wasClean=${event.wasClean}`);
        // Only transition to ended if we successfully connected
        // The state check uses the React state which may be stale in the closure,
        // so we check ws.readyState instead
        setState((current) => current === 'connected' ? 'ended' : current);
        cleanup();
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect');
      setError(error);
      onError?.(error);
      updateState('error');
    }
  }, [state, isMuted, onMessage, onError, onConversationStarted, updateState, cleanup]);

  const disconnect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_conversation' }));
    }
    cleanup();
    updateState('ended');
  }, [cleanup, updateState]);

  const mute = useCallback(() => {
    setIsMuted(true);
  }, []);

  const unmute = useCallback(() => {
    setIsMuted(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    conversationId,
    connect,
    disconnect,
    mute,
    unmute,
    isMuted,
    error,
  };
}
