package navidrome

import (
	"context"
	"crypto/md5" //nolint:gosec // The Subsonic token scheme mandates md5(password + salt).
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"alfheim/dashboard/internal/features/integrations/media"
	"alfheim/dashboard/internal/features/plugins"
)

// Subsonic protocol parameters sent with every request.
const (
	apiVersion   = "1.16.1"
	clientName   = "alfheim"
	maxBodyBytes = 1 << 20
	redacted     = "[redacted]"
)

// secretParams are the query parameters that carry credential material.
var secretParams = []string{"t", "s", "p"}

// envelope is the "subsonic-response" object of every answer.
type envelope struct {
	Status        string          `json:"status"`
	Version       string          `json:"version"`
	ServerVersion string          `json:"serverVersion"`
	Error         *subsonicError  `json:"error"`
	NowPlaying    *nowPlayingList `json:"nowPlaying"`
}

type subsonicError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type nowPlayingList struct {
	Entry []nowPlayingEntry `json:"entry"`
}

// authFailureCodes are the Subsonic error codes for rejected credentials:
// wrong user or password, token auth unsupported, and not authorized.
var authFailureCodes = map[int]bool{40: true, 41: true, 50: true}

// authParams returns the signed query of one request:
// u, t = md5(password + salt), s, v, c and f.
func (p *Plugin) authParams(creds plugins.Credentials) (url.Values, error) {
	user, password := creds[CredentialUsername], creds[CredentialPassword]
	if user == "" || password == "" {
		return nil, media.ErrMissingCredentials
	}
	salt, err := p.salt()
	if err != nil {
		return nil, err
	}
	sum := md5.Sum([]byte(password + salt)) //nolint:gosec // Mandated by the Subsonic API.
	return url.Values{
		"u": {user},
		"t": {hex.EncodeToString(sum[:])},
		"s": {salt},
		"v": {apiVersion},
		"c": {clientName},
		"f": {"json"},
	}, nil
}

// call sends a signed GET to /rest/<endpoint> and returns the envelope of a
// successful answer. Errors never carry the signed URL in clear text.
func (p *Plugin) call(ctx context.Context, cfg plugins.Config, creds plugins.Credentials, endpoint string) (envelope, error) {
	query, err := p.authParams(creds)
	if err != nil {
		return envelope{}, err
	}
	target, err := url.Parse(strings.TrimRight(cfg.BaseURL, "/") + "/rest/" + endpoint)
	if err != nil {
		return envelope{}, fmt.Errorf("build navidrome url: %w", err)
	}
	target.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target.String(), nil)
	if err != nil {
		return envelope{}, fmt.Errorf("build navidrome request: %w", redactError(err))
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return envelope{}, fmt.Errorf("navidrome request: %w", redactError(err))
	}
	defer func() {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxBodyBytes))
		_ = resp.Body.Close()
	}()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return envelope{}, media.ErrAuthFailed
	}
	if resp.StatusCode != http.StatusOK {
		return envelope{}, fmt.Errorf("%w: status %d", media.ErrUpstream, resp.StatusCode)
	}
	var body struct {
		Response *envelope `json:"subsonic-response"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxBodyBytes)).Decode(&body); err != nil || body.Response == nil {
		return envelope{}, fmt.Errorf("%w: not a Subsonic JSON answer", media.ErrUpstream)
	}
	env := *body.Response
	if env.Status != "ok" {
		if env.Error != nil && authFailureCodes[env.Error.Code] {
			return envelope{}, media.ErrAuthFailed
		}
		code := 0
		if env.Error != nil {
			code = env.Error.Code
		}
		return envelope{}, fmt.Errorf("%w: subsonic error %d", media.ErrUpstream, code)
	}
	return env, nil
}

// RedactURL returns raw with the values of t, s and p replaced, so a signed
// Subsonic URL can be logged. An unparsable URL is replaced as a whole.
func RedactURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return redacted
	}
	q := u.Query()
	changed := false
	for _, k := range secretParams {
		if q.Has(k) {
			q.Set(k, redacted)
			changed = true
		}
	}
	if changed {
		u.RawQuery = q.Encode()
	}
	return u.String()
}

// redactError rewrites the URL inside a *url.Error, which net/http embeds in
// every transport error, so the token and salt never reach a log line.
func redactError(err error) error {
	var uerr *url.Error
	if errors.As(err, &uerr) {
		return &url.Error{Op: uerr.Op, URL: RedactURL(uerr.URL), Err: uerr.Err}
	}
	return err
}
