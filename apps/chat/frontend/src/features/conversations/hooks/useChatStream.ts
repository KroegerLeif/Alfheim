"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { postMessage, streamAssistantReply, type StreamFailure } from "@/lib/api";
import { useCreateConversation } from "@/features/conversations/services/conversationService";
import type { Conversation, ToolCallView } from "@/features/conversations/types";

interface Draft {
  content: string;
  attachmentIds: string[];
}

/**
 * Why the last send did not end in a reply. `create` and `post` failures keep the draft
 * so a retry can resend it; `stream` and `stopped` leave the user message stored on the
 * server, so a retry only reopens the stream.
 */
export type ChatFailure =
  | { stage: "noModel" }
  | ({ stage: "create" | "post"; detail?: string } & Draft)
  | { stage: "stream"; conversationId: string; failure: StreamFailure }
  | { stage: "stopped"; conversationId: string };

interface UseChatStreamOptions {
  conversationId: string | null;
  /** Model block a conversation created on the first send uses. */
  newConversationModelId?: string;
  onConversationCreated?: (conversationId: string) => void;
}

const messagesKey = (id: string) => ["chat", "conversations", id, "messages"];

/**
 * Drives sending a message and streaming ALFI's reply: creates the conversation on the
 * first send, posts the user message, streams deltas and tool calls, and exposes stop
 * and retry. A running stream is aborted when the active conversation changes or the
 * view unmounts.
 */
export function useChatStream({ conversationId, newConversationModelId, onConversationCreated }: UseChatStreamOptions) {
  const queryClient = useQueryClient();
  const createConversation = useCreateConversation();
  const [created, setCreated] = useState<Conversation | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [liveToolCalls, setLiveToolCalls] = useState<ToolCallView[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [failure, setFailure] = useState<ChatFailure | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamConvoRef = useRef<string | null>(null);
  const createdIdRef = useRef<string | null>(null);

  const activeId = conversationId ?? created?.id ?? null;

  // Once the page has adopted the created conversation, leaving it (back, delete) must
  // not fall back to it.
  const prevConversationIdRef = useRef(conversationId);
  useEffect(() => {
    if (prevConversationIdRef.current !== null && conversationId === null) {
      setCreated(null);
    }
    prevConversationIdRef.current = conversationId;
  }, [conversationId]);

  const resetStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamConvoRef.current = null;
    setIsStreaming(false);
    setStreamingText("");
    setLiveToolCalls([]);
  }, []);

  // Switching to another conversation abandons the running stream and its errors. The
  // switch to a conversation this hook just created is part of the same send, so it
  // keeps a failure that send reports.
  useEffect(() => {
    if (streamConvoRef.current && streamConvoRef.current !== activeId) {
      resetStream();
    }
    if (activeId !== createdIdRef.current) {
      setFailure(null);
    }
  }, [activeId, resetStream]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const refreshMessages = useCallback(
    (id: string) => queryClient.invalidateQueries({ queryKey: messagesKey(id) }),
    [queryClient]
  );

  const startStream = async (targetId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    streamConvoRef.current = targetId;
    setFailure(null);
    setIsStreaming(true);
    setStreamingText("");
    setLiveToolCalls([]);

    const finish = () => {
      abortRef.current = null;
      streamConvoRef.current = null;
      setIsStreaming(false);
      setStreamingText("");
      setLiveToolCalls([]);
      refreshMessages(targetId);
    };

    await streamAssistantReply(
      targetId,
      {
        onDelta: (text) => {
          // Text after a tool call means the tools of that round have finished.
          setLiveToolCalls((calls) => calls.map((c) => (c.status === "running" ? { ...c, status: "done" } : c)));
          setStreamingText((prev) => prev + text);
        },
        onToolCall: (call) => setLiveToolCalls((calls) => [...calls, { ...call, status: "running" }]),
        onDone: finish,
        onError: (streamFailure) => {
          finish();
          setFailure({ stage: "stream", conversationId: targetId, failure: streamFailure });
        },
      },
      controller.signal
    );
  };

  const send = async (content: string, attachmentIds: string[]) => {
    if (isStreaming || (!content && attachmentIds.length === 0)) return;
    setFailure(null);

    let targetId = activeId;
    if (!targetId) {
      if (!newConversationModelId) {
        setFailure({ stage: "noModel" });
        return;
      }
      try {
        const conversation = await createConversation.mutateAsync({ model_block_id: newConversationModelId });
        targetId = conversation.id;
        createdIdRef.current = conversation.id;
        setCreated(conversation);
        onConversationCreated?.(conversation.id);
      } catch (err) {
        setFailure({ stage: "create", detail: err instanceof Error ? err.message : undefined, content, attachmentIds });
        return;
      }
    }

    try {
      await postMessage(targetId, content, attachmentIds);
    } catch (err) {
      setFailure({ stage: "post", detail: err instanceof Error ? err.message : undefined, content, attachmentIds });
      return;
    }
    refreshMessages(targetId);
    await startStream(targetId);
  };

  const stop = () => {
    const targetId = streamConvoRef.current;
    if (!targetId) return;
    resetStream();
    setFailure({ stage: "stopped", conversationId: targetId });
    // Tool results of finished rounds are already stored.
    refreshMessages(targetId);
  };

  const retry = async () => {
    if (!failure || isStreaming) return;
    if (failure.stage === "create" || failure.stage === "post") {
      await send(failure.content, failure.attachmentIds);
    } else if (failure.stage === "stream" || failure.stage === "stopped") {
      await startStream(failure.conversationId);
    }
  };

  return { activeId, created, streamingText, liveToolCalls, isStreaming, failure, send, stop, retry };
}
