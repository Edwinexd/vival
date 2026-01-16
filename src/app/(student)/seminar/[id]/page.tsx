"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Phone, PhoneOff, Loader2, Clock, AlertCircle } from "lucide-react";
import { useConversation } from "@/lib/elevenlabs/useConversation";

interface SeminarStatus {
  id: string;
  status: string;
  language: string;
  canStart: boolean;
  canStartReason?: string;
  activeCount?: number;
  maxConcurrent?: number;
  conversationId: string | null;
}

export default function SeminarRoomPage() {
  const params = useParams();
  const router = useRouter();
  const seminarId = params.id as string;

  const [status, setStatus] = useState<SeminarStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const t = useTranslations("seminar.room");
  const tc = useTranslations("common");

  // Duration ref for callbacks (declared early so it's available in notifyCompletion)
  const durationRef = useRef(0);

  // Report conversation_id to server after WebSocket connects
  const reportConversationId = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/seminars/${seminarId}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) {
        console.error('Failed to report conversation ID:', await res.text());
      } else {
        console.log('Conversation ID reported to server:', conversationId);
      }
    } catch (err) {
      console.error('Failed to report conversation ID:', err);
    }
  }, [seminarId]);

  // Notify server when conversation ends (fallback for when webhooks aren't available)
  const notifyCompletion = useCallback(async (completionStatus: 'ended' | 'error') => {
    try {
      const res = await fetch(`/api/seminars/${seminarId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: completionStatus, duration: durationRef.current }),
      });
      const data = await res.json();
      console.log('Seminar completion response:', data);
    } catch (err) {
      console.error('Failed to notify seminar completion:', err);
    }
  }, [seminarId]);

  const conversation = useConversation({
    onStateChange: (newState) => {
      if (newState === 'ended') {
        notifyCompletion('ended');
        router.push('/results');
      } else if (newState === 'error') {
        notifyCompletion('error');
      }
    },
    onError: (err) => {
      setError(err.message);
    },
    onConversationStarted: reportConversationId,
  });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/seminars/${seminarId}/status`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch status');
      }
      const data = await res.json();
      setStatus(data);

      if (data.status === 'in_progress' && data.conversationId) {
        // Seminar already in progress - would need to reconnect
        // For now, show as connected state
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("errors.loadFailed"));
    }
  }, [seminarId, tc]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (status?.status === 'waiting' || (status?.canStart === false && status?.status === 'booked')) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [status, fetchStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartSeminar = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const res = await fetch(`/api/seminars/${seminarId}/start`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start seminar');
      }

      // Connect to ElevenLabs using the signed URL and config override
      await conversation.connect({
        signedUrl: data.signedUrl,
        configOverride: data.configOverride,
      });

      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("errors.loadFailed"));
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndCall = () => {
    conversation.disconnect();
  };

  const toggleMute = () => {
    if (conversation.isMuted) {
      conversation.unmute();
    } else {
      conversation.mute();
    }
  };

  // Derive connection state from conversation hook
  const connectionState = isStarting ? 'connecting' : conversation.state;

  // Duration tracking - updates durationRef for use in callbacks
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (connectionState === 'connected') {
      const interval = setInterval(() => {
        setDuration(d => {
          const newDuration = d + 1;
          durationRef.current = newDuration;
          return newDuration;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setDuration(0);
      durationRef.current = 0;
    }
  }, [connectionState]);

  if (error && !status) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t("error")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button className="mt-4" onClick={() => router.push('/')}>
              {tc("actions.returnToDashboard")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {status.language === 'sv' ? t("subtitleSwedish") : t("subtitleEnglish")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("sessionStatus")}</CardTitle>
              <CardDescription>
                {connectionState === 'idle' && t("readyToStart")}
                {connectionState === 'connecting' && t("connecting")}
                {connectionState === 'connected' && t("inProgress")}
                {connectionState === 'ended' && t("ended")}
                {connectionState === 'error' && t("connectionError")}
              </CardDescription>
            </div>
            <Badge variant={
              connectionState === 'connected' ? 'default' :
              connectionState === 'error' ? 'destructive' :
              'secondary'
            }>
              {status.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {connectionState === 'idle' && !status.canStart && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <p className="text-lg font-medium mb-2">{t("waitingForSlot")}</p>
              <p className="text-muted-foreground mb-4">
                {t("slotsInUse", { active: status.activeCount ?? 0, max: status.maxConcurrent ?? 8 })}
              </p>
              <p className="text-sm text-muted-foreground">{t("pageWillUpdate")}</p>
            </div>
          )}

          {connectionState === 'idle' && status.canStart && (
            <div className="text-center py-8">
              <Mic className="h-12 w-12 mx-auto text-primary mb-4" />
              <p className="text-lg font-medium mb-2">{t("readyToBegin")}</p>
              <p className="text-muted-foreground mb-6">{t("readyInstructions")}</p>
              <Button size="lg" onClick={handleStartSeminar}>
                <Phone className="mr-2 h-5 w-5" />
                {t("startExamination")}
              </Button>
            </div>
          )}

          {connectionState === 'connecting' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">{tc("actions.loading")}</p>
              <p className="text-muted-foreground">{t("pleaseWait")}</p>
            </div>
          )}

          {connectionState === 'connected' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-2 text-2xl font-mono">
                <Clock className="h-6 w-6" />
                <span>{formatDuration(duration)}</span>
                <span className="text-muted-foreground text-sm">/ 30:00</span>
              </div>

              <div className="h-32 bg-muted rounded-lg flex items-center justify-center">
                <div className="flex items-center gap-1">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-primary rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 60 + 20}px`,
                        animationDelay: `${i * 50}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button
                  variant={conversation.isMuted ? "destructive" : "outline"}
                  size="lg"
                  onClick={toggleMute}
                >
                  {conversation.isMuted ? (
                    <>
                      <MicOff className="mr-2 h-5 w-5" />
                      {t("unmute")}
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-5 w-5" />
                      {t("mute")}
                    </>
                  )}
                </Button>

                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleEndCall}
                >
                  <PhoneOff className="mr-2 h-5 w-5" />
                  {t("endCall")}
                </Button>
              </div>
            </div>
          )}

          {connectionState === 'ended' && (
            <div className="text-center py-8">
              <div className="h-12 w-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-lg font-medium mb-2">{t("examinationComplete")}</p>
              <p className="text-muted-foreground mb-6">{t("examinationRecorded")}</p>
              <Button onClick={() => router.push('/results')}>
                {tc("actions.viewResults")}
              </Button>
            </div>
          )}

          {connectionState === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-lg font-medium mb-2">{t("connectionErrorTitle")}</p>
              <p className="text-muted-foreground mb-4">{error || conversation.error?.message}</p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={() => router.push('/')}>
                  {tc("actions.returnToDashboard")}
                </Button>
                <Button onClick={() => {
                  setError(null);
                  fetchStatus();
                }}>
                  {tc("actions.tryAgain")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {connectionState === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>{t("beforeYouBegin")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>{t("instructions.quietEnvironment")}</li>
              <li>{t("instructions.testMicrophone")}</li>
              <li>{t("instructions.duration")}</li>
              <li>{t("instructions.speakClearly")}</li>
              <li>{t("instructions.aboutCode")}</li>
              <li>
                {status.language === 'sv'
                  ? t("instructions.conductedInSwedish")
                  : t("instructions.conductedInEnglish")}
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
