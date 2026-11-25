package homeassistant

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

// Webhook headers and limits (#960).
const (
	// HeaderWebhookID names the plugin row (its id from GET .../webhook).
	HeaderWebhookID = "X-Alfheim-Webhook-Id"
	// HeaderTimestamp is the send time in unix seconds.
	HeaderTimestamp = "X-Alfheim-Timestamp"
	// HeaderSignature is "sha256=" + hex HMAC-SHA256 of timestamp + "." + body.
	HeaderSignature = "X-Alfheim-Signature"
	// ReplayWindow is how far the timestamp may differ from the server clock.
	ReplayWindow = 300 * time.Second
	// MaxWebhookBody caps the raw body.
	MaxWebhookBody  = 16 << 10
	signaturePrefix = "sha256="
)

// Sign returns the X-Alfheim-Signature value for timestamp and body.
func Sign(secret, timestamp string, body []byte) string {
	return signaturePrefix + hex.EncodeToString(mac(secret, timestamp, body))
}

func mac(secret, timestamp string, body []byte) []byte {
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(timestamp))
	m.Write([]byte("."))
	m.Write(body)
	return m.Sum(nil)
}

// validSignature compares header with the expected HMAC in constant time.
func validSignature(secret, timestamp string, body []byte, header string) bool {
	hexSig, ok := strings.CutPrefix(header, signaturePrefix)
	if !ok {
		return false
	}
	got, err := hex.DecodeString(hexSig)
	if err != nil {
		return false
	}
	return hmac.Equal(got, mac(secret, timestamp, body))
}

// withinWindow reports whether the unix timestamp is within ReplayWindow of now.
func withinWindow(timestamp string, now time.Time) bool {
	sec, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false
	}
	diff := now.Sub(time.Unix(sec, 0))
	return diff <= ReplayWindow && diff >= -ReplayWindow
}
