package plugins

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"

	"alfheim/go-shared/netguard"
)

// testPlugin is the test double of the framework: it validates a "mode"
// setting and, when it has a client, checks health with GET {base}/health.
type testPlugin struct {
	typ    string
	client *http.Client
	health Health
	calls  int
	mu     sync.Mutex
}

type testSettings struct {
	Mode string `json:"mode"`
}

func (p *testPlugin) Type() string { return p.typ }

func (p *testPlugin) ValidateConfig(cfg Config) error {
	var s testSettings
	if err := cfg.Decode(&s); err != nil {
		return err
	}
	if s.Mode == "bad" {
		return NewValidationError("config.mode", "mode must not be bad")
	}
	return nil
}

func (p *testPlugin) HealthCheck(ctx context.Context, cfg Config, creds Credentials) Health {
	p.mu.Lock()
	p.calls++
	p.mu.Unlock()
	if p.client == nil {
		return p.health
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cfg.BaseURL+"/health", nil)
	if err != nil {
		return Health{Status: StatusInvalidConfig, Detail: "bad url"}
	}
	req.Header.Set("Authorization", "Bearer "+creds["token"])
	resp, err := p.client.Do(req)
	if err != nil {
		return HealthFromError(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusUnauthorized {
		// A careless plugin echoing the token; the framework must redact it.
		return Health{Status: StatusAuthFailed, Detail: "token " + creds["token"] + " rejected"}
	}
	return Health{Status: StatusOK, Detail: "connected"}
}

func (p *testPlugin) callCount() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.calls
}

// memRepo is an in-memory Repository that filters by household like the SQL one.
type memRepo struct {
	mu   sync.Mutex
	rows map[string]Record
	err  error
}

func newMemRepo() *memRepo { return &memRepo{rows: map[string]Record{}} }

func key(hh uuid.UUID, t string) string { return hh.String() + "|" + t }

func (m *memRepo) List(_ context.Context, hh uuid.UUID) ([]Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return nil, m.err
	}
	var out []Record
	for _, r := range m.rows {
		if r.HouseholdID == hh {
			out = append(out, r)
		}
	}
	return out, nil
}

func (m *memRepo) Get(_ context.Context, hh uuid.UUID, t string) (Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return Record{}, m.err
	}
	r, ok := m.rows[key(hh, t)]
	if !ok {
		return Record{}, ErrNotConfigured
	}
	return r, nil
}

func (m *memRepo) Upsert(_ context.Context, rec *Record) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return m.err
	}
	if old, ok := m.rows[key(rec.HouseholdID, rec.Type)]; ok {
		rec.ID, rec.CreatedAt = old.ID, old.CreatedAt
	} else {
		rec.ID, rec.CreatedAt = uuid.New(), time.Now()
	}
	rec.UpdatedAt = time.Now()
	rec.HealthStatus, rec.HealthCheckedAt, rec.HealthDetail = StatusUnknown, nil, ""
	rec.CredentialsEncrypted = bytes.Clone(rec.CredentialsEncrypted)
	m.rows[key(rec.HouseholdID, rec.Type)] = *rec
	return nil
}

func (m *memRepo) SaveHealth(_ context.Context, hh uuid.UUID, t string, h HealthResult) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.rows[key(hh, t)]
	if !ok {
		return ErrNotConfigured
	}
	checked := h.CheckedAt
	r.HealthStatus, r.HealthDetail, r.HealthCheckedAt = h.Status, h.Detail, &checked
	m.rows[key(hh, t)] = r
	return nil
}

var testKey = bytes.Repeat([]byte{0x42}, 32)

func discardLog() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func mustGuard(spec string) *netguard.Guard {
	g, err := netguard.New(spec)
	if err != nil {
		panic(err)
	}
	return g
}

func mustCipher(key []byte, id string) *Cipher {
	c, err := NewCipher(key, id)
	if err != nil {
		panic(err)
	}
	return c
}

// newTestService returns a service with one plugin, a key and guard spec.
func newTestService(repo Repository, p Plugin, key []byte, guardSpec string) *Service {
	reg, err := NewRegistry(p)
	if err != nil {
		panic(err)
	}
	return NewService(repo, reg, mustCipher(key, "v1"), mustGuard(guardSpec), 0)
}
