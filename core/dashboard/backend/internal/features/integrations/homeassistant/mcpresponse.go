package homeassistant

import (
	"context"
	"io"
	"mime"
	"net/http"
)

// filterBody removes control tools from a JSON or event-stream answer.
func filterBody(contentType string, body []byte) ([]byte, error) {
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, errMalformedMCP
	}
	switch mediaType {
	case "text/event-stream":
		return filterEventStream(body)
	case "application/json":
		return filterToolLists(body)
	default:
		return nil, errMalformedMCP
	}
}

// writeDenied answers the JSON-RPC errors of blocked control calls.
func writeDenied(w http.ResponseWriter, denied []map[string]any, batch bool) {
	if batch {
		writeJSON(w, http.StatusOK, denied)
		return
	}
	writeJSON(w, http.StatusOK, denied[0])
}

// cancelOnClose releases the request context once the body is closed.
type cancelOnClose struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (c cancelOnClose) Close() error {
	defer c.cancel()
	return c.ReadCloser.Close()
}
