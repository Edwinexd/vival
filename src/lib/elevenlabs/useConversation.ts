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
  const audioReadyRef = useRef(false);

  const updateState = useCallback((newState: ConversationState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  const cleanup = useCallback(() => {
    // Reset audio ready flag
    audioReadyRef.current = false;

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

      // Audio queue for sequential playback
      let audioEndTime = 0;
      const activeSources: AudioBufferSourceNode[] = [];

      const stopAllAudio = () => {
        activeSources.forEach(source => {
          try {
            source.stop();
          } catch {
            // Already stopped
          }
        });
        activeSources.length = 0;
        audioEndTime = 0;
      };

      const playAudioChunk = (float32Array: Float32Array) => {
        const audioBuffer = audioContext.createBuffer(1, float32Array.length, 16000);
        audioBuffer.getChannelData(0).set(float32Array);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        // Track this source so we can stop it on interruption
        activeSources.push(source);
        source.onended = () => {
          const idx = activeSources.indexOf(source);
          if (idx > -1) activeSources.splice(idx, 1);
        };

        // Schedule this chunk to play after the previous one ends
        const now = audioContext.currentTime;
        const startTime = Math.max(now, audioEndTime);
        source.start(startTime);
        audioEndTime = startTime + audioBuffer.duration;
      };

      // Helper to start audio capture - called after ElevenLabs is ready
      let audioPacketCount = 0;
      const startAudioCapture = async () => {
        if (audioReadyRef.current) return; // Already started
        audioReadyRef.current = true;

        // Resume audio context if suspended (browser security)
        if (audioContext.state === 'suspended') {
          console.log('[ElevenLabs] Resuming suspended AudioContext');
          await audioContext.resume();
        }
        console.log('[ElevenLabs] AudioContext state:', audioContext.state);

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && !isMuted && audioReadyRef.current) {
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert to 16-bit PCM
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }
            // Convert to base64 for JSON transport
            const uint8Array = new Uint8Array(pcmData.buffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const base64Audio = btoa(binary);

            const audioMessage = {
              user_audio_chunk: base64Audio,
            };

            audioPacketCount++;
            ws.send(JSON.stringify(audioMessage));
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        console.log('[ElevenLabs] Audio capture started, ready to send audio');
      };

      ws.onopen = () => {
        console.log('[ElevenLabs] WebSocket opened');
        // Send conversation initiation data with overrides before anything else
        if (configOverride) {
          const initMessage = {
            type: 'conversation_initiation_client_data',
            conversation_config_override: configOverride,
          };
          console.log('[ElevenLabs] Sending config override (prompt hidden)');
          ws.send(JSON.stringify(initMessage));
        }
        // Don't start audio yet - wait for conversation_initiation_metadata
      };

      ws.onmessage = async (event) => {
        try {
          const dataType = event.data instanceof Blob ? 'Blob' :
                          event.data instanceof ArrayBuffer ? 'ArrayBuffer' :
                          typeof event.data;

          if (event.data instanceof Blob) {
            // Audio data from agent - raw PCM 16-bit signed, 16kHz mono
            try {
              const arrayBuffer = await event.data.arrayBuffer();
              const int16Array = new Int16Array(arrayBuffer);

              // Convert Int16 PCM to Float32 for Web Audio API
              const float32Array = new Float32Array(int16Array.length);
              for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768;
              }

              // Create AudioBuffer and play
              const audioBuffer = audioContext.createBuffer(1, float32Array.length, 16000);
              audioBuffer.getChannelData(0).set(float32Array);

              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              source.start();
            } catch (audioErr) {
              console.error('[ElevenLabs] Audio playback error:', audioErr);
            }
          } else if (event.data instanceof ArrayBuffer) {
            console.log('[ElevenLabs] Received ArrayBuffer, size:', event.data.byteLength);
          } else {
            // JSON message
            const message = JSON.parse(event.data);

            if (message.type === 'audio' || message.audio_event) {
              // Play base64 audio from JSON
              try {
                const audioData = message.audio_event?.audio_base_64;
                if (audioData && typeof audioData === 'string') {
                  const binaryString = atob(audioData);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  // Treat as PCM 16-bit
                  const int16Array = new Int16Array(bytes.buffer);
                  const float32Array = new Float32Array(int16Array.length);
                  for (let i = 0; i < int16Array.length; i++) {
                    float32Array[i] = int16Array[i] / 32768;
                  }
                  playAudioChunk(float32Array);
                }
              } catch (audioErr) {
                console.error('[ElevenLabs] Failed to play JSON audio:', audioErr);
              }
            } else if (message.type === 'interruption') {
              // User interrupted - stop all playing audio
              stopAllAudio();
            } else if (message.type === 'conversation_initiation_metadata') {
              // ElevenLabs sends this after connection with the conversation_id
              const convId = message.conversation_id;
              if (convId) {
                console.log('Conversation started with ID:', convId);
                setConversationId(convId);
                onConversationStarted?.(convId);
              }
              // Now ElevenLabs is ready - start audio capture
              updateState('connected');
              startAudioCapture();
            } else if (message.type === 'agent_response') {
              onMessage?.(message.agent_response_event?.agent_response || '', 'agent');
            } else if (message.type === 'user_transcript') {
              onMessage?.(message.user_transcription_event?.user_transcript || '', 'user');
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
        console.error('[ElevenLabs] WebSocket error:', event);
        const err = new Error('WebSocket connection error');
        setError(err);
        onError?.(err);
        updateState('error');
      };

      ws.onclose = (event) => {
        console.log(`[ElevenLabs] WebSocket closed: code=${event.code}, reason=${event.reason}, wasClean=${event.wasClean}, audioReady=${audioReadyRef.current}`);

        // Check if this was an error close (not normal closure)
        // 1000 = normal close, 1001 = going away (normal)
        // Anything else or a reason message indicates an error
        const isErrorClose = event.code !== 1000 && event.code !== 1001;
        const hasErrorReason = event.reason && event.reason.length > 0;

        if (isErrorClose || hasErrorReason) {
          const errorMessage = event.reason || `Connection closed unexpectedly (code: ${event.code})`;
          console.error('[ElevenLabs] WebSocket closed with error:', errorMessage);
          const err = new Error(errorMessage);
          setError(err);
          onError?.(err);
          updateState('error');
        } else {
          // Normal close - only transition to ended if we were connected
          setState((current) => current === 'connected' ? 'ended' : current);
        }
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
