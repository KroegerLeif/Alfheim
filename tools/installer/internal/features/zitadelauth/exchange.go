package zitadelauth

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ErrRejected marks a token request Zitadel refused (an expired, deleted or
// foreign machine key), as opposed to a transient failure worth retrying.
var ErrRejected = errors.New("zitadelauth: Zitadel rejected the machine key")

// jwtBearerGrant is the RFC 7523 grant type Zitadel calls "JWT profile".
const jwtBearerGrant = "urn:ietf:params:oauth:grant-type:jwt-bearer"

// apiScope asks for an access token whose audience includes Zitadel's own
// APIs; without it the Management and Admin APIs refuse the token.
const apiScope = "openid urn:zitadel:iam:org:project:id:zitadel:aud"

// assertionLifetime bounds the signed JWT itself. It is only presented once,
// right away, so a few minutes cover any clock skew between host and Zitadel.
const assertionLifetime = 5 * time.Minute

// Exchanger trades a machine key for a short-lived access token at Zitadel's
// token endpoint, reached through Caddy the same way the provisioning client
// reaches the Management API.
type Exchanger struct {
	// BaseURL is where Caddy listens, e.g. https://auth.example.com.
	BaseURL string
	// Host is the external auth domain Zitadel resolves the instance by.
	Host string
	// Audience is Zitadel's issuer URL, which the assertion's aud must name.
	Audience string
	// HTTP is the transport. Defaults to http.DefaultClient.
	HTTP *http.Client
	// Now is injectable for tests. Defaults to time.Now.
	Now func() time.Time
	// Sleep waits between retries of a transient failure. Defaults to a
	// context-aware real sleep.
	Sleep func(ctx context.Context, d time.Duration) error
}

// Exchange signs an assertion with key and returns the access token Zitadel
// issues for it. Transient failures (network errors, 5xx) are retried with
// a bounded backoff; a refusal wraps ErrRejected.
func (e Exchanger) Exchange(ctx context.Context, key Key) (string, error) {
	assertion, err := signAssertion(key, e.Audience, e.now())
	if err != nil {
		return "", err
	}
	form := url.Values{"grant_type": {jwtBearerGrant}, "scope": {apiScope}, "assertion": {assertion}}.Encode()

	var lastErr error
	delay := 500 * time.Millisecond
	for attempt := 0; attempt < 5; attempt++ {
		if attempt > 0 {
			if err := e.sleep(ctx, delay); err != nil {
				return "", err
			}
			delay *= 2
		}
		token, retry, err := e.post(ctx, form)
		if err == nil {
			return token, nil
		}
		if !retry {
			return "", err
		}
		lastErr = err
	}
	return "", fmt.Errorf("zitadelauth: token request failed after 5 attempts: %w", lastErr)
}

// post performs one token request and reports whether a failure is worth
// retrying.
func (e Exchanger) post(ctx context.Context, form string) (token string, retry bool, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.BaseURL+"/oauth/v2/token", strings.NewReader(form))
	if err != nil {
		return "", false, fmt.Errorf("zitadelauth: build token request: %w", err)
	}
	req.Host = e.Host
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := e.HTTP
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", true, fmt.Errorf("zitadelauth: token request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", true, fmt.Errorf("zitadelauth: read token response: %w", err)
	}

	switch {
	case resp.StatusCode >= 500:
		return "", true, fmt.Errorf("zitadelauth: token endpoint returned HTTP %d: %s", resp.StatusCode, body)
	case resp.StatusCode >= 400:
		// The error body is Zitadel's OAuth error description; it never
		// echoes the assertion.
		return "", false, fmt.Errorf("%w: HTTP %d: %s", ErrRejected, resp.StatusCode, body)
	case resp.StatusCode != http.StatusOK:
		return "", false, fmt.Errorf("zitadelauth: token endpoint returned HTTP %d", resp.StatusCode)
	}
	var parsed struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", false, fmt.Errorf("zitadelauth: decode token response: %w", err)
	}
	if parsed.AccessToken == "" {
		return "", false, errors.New("zitadelauth: token response carries no access_token")
	}
	return parsed.AccessToken, false, nil
}

func (e Exchanger) now() time.Time {
	if e.Now != nil {
		return e.Now()
	}
	return time.Now()
}

func (e Exchanger) sleep(ctx context.Context, d time.Duration) error {
	if e.Sleep != nil {
		return e.Sleep(ctx, d)
	}
	return realSleep(ctx, d)
}

// signAssertion builds the RS256 JWT Zitadel's JWT profile grant expects:
// issuer and subject are the machine user, the audience is the issuer URL,
// and kid names the key so Zitadel can find its public half.
func signAssertion(key Key, audience string, now time.Time) (string, error) {
	if key.private == nil {
		return "", errors.New("zitadelauth: machine key was not parsed with ParseKey")
	}
	header, err := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT", "kid": key.KeyID})
	if err != nil {
		return "", fmt.Errorf("zitadelauth: encode assertion header: %w", err)
	}
	claims, err := json.Marshal(map[string]any{
		"iss": key.UserID,
		"sub": key.UserID,
		"aud": audience,
		"iat": now.Unix(),
		"exp": now.Add(assertionLifetime).Unix(),
	})
	if err != nil {
		return "", fmt.Errorf("zitadelauth: encode assertion claims: %w", err)
	}
	enc := base64.RawURLEncoding
	signingInput := enc.EncodeToString(header) + "." + enc.EncodeToString(claims)
	digest := sha256.Sum256([]byte(signingInput))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key.private, crypto.SHA256, digest[:])
	if err != nil {
		return "", fmt.Errorf("zitadelauth: sign assertion: %w", err)
	}
	return signingInput + "." + enc.EncodeToString(signature), nil
}

// realSleep waits for d, or returns early when ctx is cancelled.
func realSleep(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
