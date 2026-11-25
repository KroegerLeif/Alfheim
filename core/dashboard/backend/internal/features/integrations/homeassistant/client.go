package homeassistant

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// maxRESTBody caps a REST answer of Home Assistant.
const maxRESTBody = 256 << 10

// errUnexpectedStatus marks a non-200 answer of Home Assistant.
var errUnexpectedStatus = errors.New("home assistant answered with an unexpected status")

// endpoint joins the base URL and an absolute API path.
func endpoint(baseURL, path string) string {
	return strings.TrimRight(baseURL, "/") + path
}

// getJSON calls GET {base}{path} with the token and decodes a 200 answer into
// out. It returns the HTTP status (0 when no answer arrived). Errors never
// carry the token: the request URL holds none, and the transport error is
// wrapped as is only for the caller's classification.
func getJSON(ctx context.Context, client *http.Client, baseURL, path, token string, out any) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint(baseURL, path), nil)
	if err != nil {
		return 0, fmt.Errorf("build home assistant request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	body := io.LimitReader(resp.Body, maxRESTBody)
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, body)
		return resp.StatusCode, fmt.Errorf("%w: %d", errUnexpectedStatus, resp.StatusCode)
	}
	if err := json.NewDecoder(body).Decode(out); err != nil {
		return resp.StatusCode, fmt.Errorf("decode home assistant answer: %w", err)
	}
	return resp.StatusCode, nil
}
