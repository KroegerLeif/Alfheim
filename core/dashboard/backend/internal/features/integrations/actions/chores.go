package actions

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strconv"
	"strings"

	"alfheim/go-shared/household"
)

// ChoresScope is the binding scope ActionCreateChoreInstance needs (#959).
const ChoresScope = "chores:create_instance"

// TokenProvider returns a service principal access token.
type TokenProvider interface {
	Token(ctx context.Context) (string, error)
}

// ChoresExecutor runs ActionCreateChoreInstance against the chores public API
// (POST /api/v1/chores/instances) as the household's service principal, with
// the event id as Idempotency-Key, so a retried event never creates a second
// instance.
type ChoresExecutor struct {
	baseURL   string
	installed bool
	tokens    TokenProvider
	client    *http.Client
}

// NewChoresExecutor returns the executor. installed is false when the
// installation does not run chores (ALFHEIM_ENABLED_APPS); tokens is nil when
// no service principal is configured.
func NewChoresExecutor(baseURL string, installed bool, tokens TokenProvider, client *http.Client) *ChoresExecutor {
	return &ChoresExecutor{baseURL: strings.TrimRight(baseURL, "/"), installed: installed, tokens: tokens, client: client}
}

// Execute creates the chore instance.
func (e *ChoresExecutor) Execute(ctx context.Context, ex Execution) Result {
	if !e.installed {
		return Result{Status: StatusSkipped, Detail: "chores is not installed"}
	}
	if e.tokens == nil {
		return Result{Status: StatusFailed, Detail: "no service principal is configured"}
	}
	params, err := decodeChoreParams(ex.Params)
	if err != nil {
		return Result{Status: StatusFailed, Detail: "the rule has no valid template_id"}
	}
	token, err := e.tokens.Token(ctx)
	if err != nil {
		return Result{Status: StatusFailed, Detail: "no service principal token could be obtained"}
	}
	body := []byte(`{"template_id":"` + params.TemplateID + `"}`)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.baseURL+"/api/v1/chores/instances", bytes.NewReader(body))
	if err != nil {
		return Result{Status: StatusFailed, Detail: "the chores request could not be built"}
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set(household.HouseholdHeader, ex.HouseholdID.String())
	req.Header.Set("Idempotency-Key", ex.EventID)
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.client.Do(req)
	if err != nil {
		return Result{Status: StatusFailed, Detail: "chores could not be reached"}
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
	switch resp.StatusCode {
	case http.StatusCreated:
		return Result{Status: StatusExecuted, Detail: "chore instance created"}
	case http.StatusOK:
		return Result{Status: StatusExecuted, Detail: "chore instance already existed"}
	case http.StatusForbidden, http.StatusUnauthorized:
		return Result{Status: StatusFailed, Detail: "the household's service binding does not allow this action"}
	case http.StatusNotFound:
		return Result{Status: StatusFailed, Detail: "the chore template does not exist in this household"}
	default:
		return Result{Status: StatusFailed, Detail: "chores answered with status " + strconv.Itoa(resp.StatusCode)}
	}
}
