package app

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
)

// stubMachineUserID is the provisioning machine user the credential stub
// pretends the bearer token belongs to.
const stubMachineUserID = "machine-1"

var (
	stubRSAKeyOnce sync.Once
	stubRSAKeyPEM  string
)

// stubPrivateKeyPEM returns one PKCS#1 RSA key shared by every test, since
// generating a key per test would dominate the package's run time.
func stubPrivateKeyPEM() string {
	stubRSAKeyOnce.Do(func() {
		key, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			panic(err)
		}
		stubRSAKeyPEM = string(pem.EncodeToMemory(&pem.Block{
			Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key),
		}))
	})
	return stubRSAKeyPEM
}

// stubKeyJSON renders a machine key file the way Zitadel returns it.
func stubKeyJSON(keyID string) []byte {
	data, err := json.Marshal(map[string]string{
		"type": "serviceaccount", "keyId": keyID, "key": stubPrivateKeyPEM(), "userId": stubMachineUserID,
	})
	if err != nil {
		panic(err)
	}
	return data
}

// credentialStub answers the Zitadel calls of the machine key rotation:
// identify the user, add, list and delete keys, list and delete PATs, and
// the JWT profile token exchange (which accepts any key it still holds).
// A malformed assertion is answered like an unknown key, which fails the
// calling test visibly.
type credentialStub struct {
	mu       sync.Mutex
	nextKey  int
	keys     map[string]bool
	pats     map[string]bool
	exchange int
}

func newCredentialStub() *credentialStub {
	return &credentialStub{keys: map[string]bool{}, pats: map[string]bool{"pat-1": true}}
}

// handle answers a credential request and reports whether it did.
func (c *credentialStub) handle(w http.ResponseWriter, r *http.Request) bool {
	userPrefix := "/management/v1/users/" + stubMachineUserID + "/"
	if r.URL.Path != "/auth/v1/users/me" && r.URL.Path != "/oauth/v2/token" &&
		!strings.HasPrefix(r.URL.Path, userPrefix) {
		return false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	rest := strings.TrimPrefix(r.URL.Path, userPrefix)
	var resp any = map[string]any{}
	switch {
	case r.URL.Path == "/auth/v1/users/me":
		resp = map[string]any{"user": map[string]any{"id": stubMachineUserID}}
	case r.URL.Path == "/oauth/v2/token":
		kid := assertionKeyID(r)
		if !c.keys[kid] {
			w.WriteHeader(http.StatusBadRequest)
			resp = map[string]any{"error": "invalid_grant"}
			break
		}
		c.exchange++
		resp = map[string]any{"access_token": "token-for-" + kid, "token_type": "Bearer", "expires_in": 43199}
	case r.Method == http.MethodPost && rest == "keys":
		c.nextKey++
		id := fmt.Sprintf("key-%d", c.nextKey)
		c.keys[id] = true
		resp = map[string]any{"keyId": id, "keyDetails": base64.StdEncoding.EncodeToString(stubKeyJSON(id))}
	case rest == "keys/_search":
		resp = map[string]any{"result": idResults(c.keys)}
	case rest == "pats/_search":
		resp = map[string]any{"result": idResults(c.pats)}
	case r.Method == http.MethodDelete && strings.HasPrefix(rest, "keys/"):
		delete(c.keys, strings.TrimPrefix(rest, "keys/"))
	case r.Method == http.MethodDelete && strings.HasPrefix(rest, "pats/"):
		delete(c.pats, strings.TrimPrefix(rest, "pats/"))
	default:
		return false
	}
	_ = json.NewEncoder(w).Encode(resp)
	return true
}

// state returns the key ids and PAT ids Zitadel still holds.
func (c *credentialStub) state() (keys, pats []string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return sortedIDs(c.keys), sortedIDs(c.pats)
}

func idResults(set map[string]bool) []map[string]string {
	out := []map[string]string{}
	for _, id := range sortedIDs(set) {
		out = append(out, map[string]string{"id": id})
	}
	return out
}

func sortedIDs(set map[string]bool) []string {
	ids := make([]string, 0, len(set))
	for id := range set {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

// assertionKeyID reads the kid from the JWT assertion's header.
func assertionKeyID(r *http.Request) string {
	if err := r.ParseForm(); err != nil {
		return ""
	}
	header, _, _ := strings.Cut(r.PostForm.Get("assertion"), ".")
	raw, err := base64.RawURLEncoding.DecodeString(header)
	if err != nil {
		return ""
	}
	var parsed struct {
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return ""
	}
	return parsed.Kid
}
