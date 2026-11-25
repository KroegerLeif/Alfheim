package homeassistant

import (
	"crypto/rand"
	"errors"
	"log/slog"
	"net/http"

	"alfheim/dashboard/internal/features/plugins"
)

// credentialSecret is the name the secret is sealed under.
const credentialSecret = "secret"

// Sealer seals and opens webhook secrets; *plugins.Cipher satisfies it, so
// they use the same key (INTEGRATIONS_ENCRYPTION_KEY) as plugin credentials.
type Sealer interface {
	Seal(creds plugins.Credentials) ([]byte, string, error)
	Open(ciphertext []byte, keyID string) (plugins.Credentials, error)
}

// WebhookInfo is the body of GET .../webhook: the id Home Assistant sends in
// X-Alfheim-Webhook-Id and whether a secret exists. The secret itself is
// shown once, by POST .../webhook/secret, and never again.
type WebhookInfo struct {
	WebhookID string `json:"webhook_id"`
	HasSecret bool   `json:"has_secret"`
	Path      string `json:"path"`
}

// SecretResponse is the body of POST .../webhook/secret.
type SecretResponse struct {
	WebhookInfo
	Secret string `json:"secret"`
}

// SecretHandler lets household admins read the webhook id and generate the
// webhook secret.
type SecretHandler struct {
	access PluginAccess
	store  SecretStore
	sealer Sealer
	log    *slog.Logger
}

// NewSecretHandler returns the handler.
func NewSecretHandler(access PluginAccess, store SecretStore, sealer Sealer, log *slog.Logger) *SecretHandler {
	return &SecretHandler{access: access, store: store, sealer: sealer, log: log}
}

// Info answers the webhook id of the household's plugin row.
func (h *SecretHandler) Info(w http.ResponseWriter, r *http.Request) {
	hc, ok := householdFrom(w, r, h.log)
	if !ok {
		return
	}
	inst, err := h.access.Instance(r.Context(), hc.HouseholdID, Type)
	if err != nil {
		writePluginErr(w, err, h.log)
		return
	}
	stored, err := h.store.Get(r.Context(), inst.ID)
	if err != nil && !errors.Is(err, ErrNoWebhook) {
		writePluginErr(w, err, h.log)
		return
	}
	hasSecret := err == nil && stored.HouseholdID == hc.HouseholdID
	writeJSON(w, http.StatusOK, WebhookInfo{WebhookID: inst.ID.String(), HasSecret: hasSecret, Path: EventsPath})
}

// Rotate generates a new secret, stores it sealed and answers it once. The
// previous secret stops working immediately.
func (h *SecretHandler) Rotate(w http.ResponseWriter, r *http.Request) {
	hc, ok := householdFrom(w, r, h.log)
	if !ok {
		return
	}
	inst, err := h.access.Instance(r.Context(), hc.HouseholdID, Type)
	if err != nil {
		writePluginErr(w, err, h.log)
		return
	}
	// Two rand.Text values: 256 bits from the operating system's CSPRNG.
	secret := rand.Text() + rand.Text()
	sealed, keyID, err := h.sealer.Seal(plugins.Credentials{credentialSecret: secret})
	if err != nil {
		writePluginErr(w, err, h.log)
		return
	}
	if err := h.store.Put(r.Context(), inst.ID, hc.HouseholdID, sealed, keyID); err != nil {
		writePluginErr(w, err, h.log)
		return
	}
	h.log.Info("home assistant webhook secret generated", slog.String("household_id", hc.HouseholdID.String()))
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, SecretResponse{
		WebhookInfo: WebhookInfo{WebhookID: inst.ID.String(), HasSecret: true, Path: EventsPath},
		Secret:      secret,
	})
}
