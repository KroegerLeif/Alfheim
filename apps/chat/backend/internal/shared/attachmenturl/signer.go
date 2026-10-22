// Package attachmenturl mints and verifies the short-lived, HMAC-signed tokens
// carried in chat attachment download URLs. An <img> element cannot send a bearer
// token, so the URL itself proves that the issuing request was authenticated for
// one user in one household and for one attachment.
package attachmenturl

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// MinSecretBytes is the shortest HMAC key accepted.
const MinSecretBytes = 32

// contentPathFormat is the path of the download endpoint for one attachment ID.
const contentPathFormat = "/api/v1/chat/attachments/%s/content"

// Verification failures. Callers map all of them to 401 without telling the
// client which check failed.
var (
	ErrMalformedToken = errors.New("malformed attachment token")
	ErrBadSignature   = errors.New("invalid attachment token signature")
	ErrExpiredToken   = errors.New("attachment token expired")
)

// Claims is the identity a verified token was issued to.
type Claims struct {
	UserID      string
	HouseholdID string
}

// Signer issues and verifies attachment tokens.
type Signer struct {
	secret  []byte
	ttl     time.Duration
	baseURL string
	now     func() time.Time
}

// NewSigner returns a Signer. baseURL (may be empty) is prefixed to URLs from URL;
// empty yields origin-relative URLs.
func NewSigner(secret []byte, ttl time.Duration, baseURL string) (*Signer, error) {
	if len(secret) < MinSecretBytes {
		return nil, fmt.Errorf("attachment URL secret must be at least %d bytes", MinSecretBytes)
	}
	if ttl <= 0 {
		return nil, errors.New("attachment URL ttl must be positive")
	}
	return &Signer{
		secret:  append([]byte(nil), secret...),
		ttl:     ttl,
		baseURL: strings.TrimRight(baseURL, "/"),
		now:     time.Now,
	}, nil
}

// TTL reports how long issued tokens stay valid.
func (s *Signer) TTL() time.Duration { return s.ttl }

// URL returns the download URL for attachmentID carrying a fresh token bound to
// userID and householdID.
func (s *Signer) URL(attachmentID, userID, householdID string) (string, error) {
	token, err := s.Sign(attachmentID, userID, householdID)
	if err != nil {
		return "", err
	}
	return s.baseURL + fmt.Sprintf(contentPathFormat, url.PathEscape(attachmentID)) + "?token=" + url.QueryEscape(token), nil
}

// Sign mints a token of the form base64url(userID).base64url(householdID).exp.base64url(mac),
// valid for the signer's TTL.
func (s *Signer) Sign(attachmentID, userID, householdID string) (string, error) {
	if attachmentID == "" || userID == "" || householdID == "" {
		return "", errors.New("attachment id, user id and household id are required")
	}
	exp := s.now().Add(s.ttl).Unix()
	enc := base64.RawURLEncoding
	return enc.EncodeToString([]byte(userID)) + "." + enc.EncodeToString([]byte(householdID)) + "." +
		strconv.FormatInt(exp, 10) + "." + enc.EncodeToString(s.mac(attachmentID, userID, householdID, exp)), nil
}

// Verify checks token for attachmentID and returns the identity it was issued to.
// The signature is checked before the expiry so that a forged token reveals nothing.
func (s *Signer) Verify(attachmentID, token string) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 4 || attachmentID == "" {
		return Claims{}, ErrMalformedToken
	}
	enc := base64.RawURLEncoding
	user, err := enc.DecodeString(parts[0])
	if err != nil {
		return Claims{}, ErrMalformedToken
	}
	household, err := enc.DecodeString(parts[1])
	if err != nil {
		return Claims{}, ErrMalformedToken
	}
	exp, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		return Claims{}, ErrMalformedToken
	}
	got, err := enc.DecodeString(parts[3])
	if err != nil {
		return Claims{}, ErrMalformedToken
	}

	want := s.mac(attachmentID, string(user), string(household), exp)
	if !hmac.Equal(got, want) {
		return Claims{}, ErrBadSignature
	}
	if !s.now().Before(time.Unix(exp, 0)) {
		return Claims{}, ErrExpiredToken
	}
	return Claims{UserID: string(user), HouseholdID: string(household)}, nil
}

// mac signs the length-prefixed fields, so no field boundary can be shifted.
func (s *Signer) mac(attachmentID, userID, householdID string, exp int64) []byte {
	h := hmac.New(sha256.New, s.secret)
	for _, field := range []string{attachmentID, userID, householdID, strconv.FormatInt(exp, 10)} {
		_, _ = fmt.Fprintf(h, "%d:%s;", len(field), field)
	}
	return h.Sum(nil)
}
