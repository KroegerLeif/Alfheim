import { afterEach, describe, expect, it, vi } from "vitest";
import { streamAssistantReply } from "@/lib/api";

function sseResponse(frames: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe("streamAssistantReply", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches delta and done events parsed from SSE frames", async () => {
    const frames = [
      'event: delta\ndata: {"text":"Hel"}\n\n',
      'event: delta\ndata: {"text":"lo"}\n\n',
      'event: done\ndata: {"usage":{"total_tokens":3}}\n\n',
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(frames)));

    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamAssistantReply("convo-1", { onDelta, onDone, onError });

    expect(onDelta).toHaveBeenNthCalledWith(1, "Hel");
    expect(onDelta).toHaveBeenNthCalledWith(2, "lo");
    expect(onDone).toHaveBeenCalledWith({ total_tokens: 3 });
    expect(onError).not.toHaveBeenCalled();
  });

  it("dispatches an error event and stops without calling onDone", async () => {
    const frames = ['event: error\ndata: {"message":"model overloaded"}\n\n'];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(frames)));

    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamAssistantReply("convo-1", { onDelta, onDone, onError });

    expect(onError).toHaveBeenCalledWith("model overloaded");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("reports a readable error when the request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: "Not Found" }))
    );

    const onError = vi.fn();
    await streamAssistantReply("missing-convo", { onDelta: vi.fn(), onDone: vi.fn(), onError });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("404"));
  });

  it("splits a frame arriving across multiple chunks", async () => {
    // Same "done" frame delivered in two separate stream chunks to exercise buffering.
    const frames = ['event: done\ndata: {"usage"', ':{"total_tokens":1}}\n\n'];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(frames)));

    const onDone = vi.fn();
    await streamAssistantReply("convo-1", { onDelta: vi.fn(), onDone, onError: vi.fn() });

    expect(onDone).toHaveBeenCalledWith({ total_tokens: 1 });
  });
});

describe("uploadAttachment and postMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads an image file via multipart form and returns attachment metadata", async () => {
    const mockAttachment = {
      id: "att-123",
      storage_key: "households/hh-1/chat/pic.png",
      mime_type: "image/png",
      size_bytes: 1024,
      url: "http://localhost/storage/households/hh-1/chat/pic.png",
      created_at: "2026-08-23T18:00:00Z",
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockAttachment), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { uploadAttachment } = await import("@/lib/api");
    const file = new File(["test-content"], "test.png", { type: "image/png" });
    const result = await uploadAttachment(file);

    expect(result.id).toBe("att-123");
    expect(result.url).toContain("pic.png");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/attachments"),
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );
  });
});
