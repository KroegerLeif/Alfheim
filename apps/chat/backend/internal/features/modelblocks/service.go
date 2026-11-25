package modelblocks

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"alfheim/chat/internal/shared/llm"
	"alfheim/go-shared/netguard"
)

// BootstrapSeed carries the ENV-configured fallback model, decoupled from the
// application-wide config.Config type so this feature package has no dependency on it.
type BootstrapSeed struct {
	Provider      string
	OllamaBaseURL string
	OllamaModel   string
	APIKey        string
}

// Service defines domain logic for model block management.
type Service interface {
	List(ctx context.Context, userID, householdID string) ([]ResponseDTO, error)
	Get(ctx context.Context, userID, householdID, id string) (ResponseDTO, error)
	Create(ctx context.Context, userID, householdID string, req CreateRequest) (ResponseDTO, error)
	Update(ctx context.Context, userID, householdID, id string, req UpdateRequest) (ResponseDTO, error)
	Delete(ctx context.Context, userID, id string) error
	TriggerHealthCheck(ctx context.Context, userID, householdID, id string) (ResponseDTO, error)
	DiscoverModels(ctx context.Context, req DiscoverRequest) (DiscoverResponse, error)
	// HouseholdDefault returns the household's default shared model block (the
	// oldest one shared with householdID) or ErrNotFound.
	HouseholdDefault(ctx context.Context, userID, householdID string) (ResponseDTO, error)
	// SaveHouseholdDefault creates or updates the household's default shared
	// model block. Only OWNER and ADMIN reach it; the HTTP layer checks the role.
	SaveHouseholdDefault(ctx context.Context, userID, householdID string, req HouseholdDefaultRequest) (ResponseDTO, bool, error)
	// EnsureBootstrap seeds the ENV-configured fallback model block exactly once,
	// on the very first successful call; subsequent calls (e.g. on every restart)
	// are no-ops even if the seeded block was since edited or deleted by a user.
	EnsureBootstrap(ctx context.Context, seed BootstrapSeed) error
	// ResolveProvider loads a model block, checks the caller may use it (owner, or a
	// shared block within the caller's household), decrypts its API key if any, and
	// constructs a ready-to-use llm.Provider plus its tool-calling policy (parsed
	// from config_json). Unlike TriggerHealthCheck/Update/Delete, this uses the
	// broader "usable" visibility rule, not the owner-only edit rule, since household
	// members are allowed to chat with shared model blocks.
	ResolveProvider(ctx context.Context, userID, householdID, id string) (llm.Provider, llm.ProviderPolicy, error)
}

// defaultToolRoundLimit caps tool-calling rounds when a model block's config_json
// does not specify its own "tool_round_limit".
const defaultToolRoundLimit = 8

type service struct {
	repo            Repository
	encryptionKey   []byte
	encryptionKeyID string
	log             *slog.Logger
	// guard validates user-supplied base URLs; httpClient dials only through it.
	guard      *netguard.Guard
	httpClient *http.Client
}

// NewServiceWithGuard creates a model block service instance. encryptionKey may be
// nil/empty if CHAT_ENCRYPTION_KEY is not configured; attempting to store an API key in
// that case fails with ErrEncryptionKeyMissing rather than silently storing plaintext.
//
// Outbound provider URLs are restricted by guard, which main builds from
// CHAT_ALLOWED_LLM_HOSTS.
func NewServiceWithGuard(repo Repository, encryptionKey []byte, encryptionKeyID string, log *slog.Logger, guard *netguard.Guard) Service {
	return &service{
		repo:            repo,
		encryptionKey:   encryptionKey,
		encryptionKeyID: encryptionKeyID,
		log:             log,
		guard:           guard,
		httpClient:      guard.NewHTTPClient(),
	}
}

// validateBaseURL rejects base URLs that are not permitted outbound destinations. The
// cause is logged; callers get the generic ErrInvalidBaseURL so the response cannot be
// used to map internal hosts.
func (s *service) validateBaseURL(ctx context.Context, baseURL *string) error {
	if baseURL == nil || strings.TrimSpace(*baseURL) == "" {
		return nil
	}
	if err := s.guard.ValidateURL(ctx, *baseURL); err != nil {
		s.log.Warn("rejected model block base url", slog.String("base_url", *baseURL), slog.String("error", err.Error()))
		return ErrInvalidBaseURL
	}
	return nil
}

func (s *service) List(ctx context.Context, userID, householdID string) ([]ResponseDTO, error) {
	blocks, err := s.repo.ListVisibleTo(ctx, userID, householdID)
	if err != nil {
		return nil, err
	}

	out := make([]ResponseDTO, 0, len(blocks))
	for _, m := range blocks {
		out = append(out, ToResponse(m, userID))
	}
	return out, nil
}

func (s *service) Get(ctx context.Context, userID, householdID, id string) (ResponseDTO, error) {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ResponseDTO{}, err
	}
	if !m.IsVisibleTo(userID, householdID) {
		return ResponseDTO{}, ErrForbidden
	}
	return ToResponse(m, userID), nil
}
