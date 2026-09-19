package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

	"alfheim/chat/internal/shared/householdclient"
)

type fakeChecker struct {
	calls atomic.Int32
	fn    func(hh uuid.UUID, sub string) (householdclient.Membership, error)
}

func (f *fakeChecker) CheckMembership(_ context.Context, hh uuid.UUID, sub string) (householdclient.Membership, error) {
	f.calls.Add(1)
	return f.fn(hh, sub)
}

type errorBody struct {
	Detail struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"detail"`
}

func withTestClaims(sub string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), UserContextKey, &UserClaims{Subject: sub})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func echoHousehold() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hc, err := GetHousehold(r.Context())
		if err != nil {
			http.Error(w, "no household", http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"household_id": hc.HouseholdID.String(), "role": string(hc.Role), "sub": hc.Subject})
	})
}

func TestRequireHousehold(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	member := uuid.MustParse("7d9f3c1e-4b2a-4c8e-9f10-2a3b4c5d6e7f")

	checker := &fakeChecker{fn: func(hh uuid.UUID, sub string) (householdclient.Membership, error) {
		switch {
		case hh == member && sub == "user-1":
			return householdclient.Membership{HouseholdID: hh, UserID: sub, Role: householdclient.RoleAdmin}, nil
		case hh == uuid.MustParse("00000000-0000-0000-0000-000000000503"):
			return householdclient.Membership{}, householdclient.ErrUnavailable
		case hh == uuid.MustParse("00000000-0000-0000-0000-000000000500"):
			return householdclient.Membership{}, errors.New("unexpected failure")
		default:
			return householdclient.Membership{}, householdclient.ErrNotMember
		}
	}}
	handler := Chain(withTestClaims("user-1"), RequireHousehold(checker, log))(echoHousehold())

	tests := []struct {
		name     string
		header   *string
		wantCode int
		wantErr  string
	}{
		{"missing header", nil, http.StatusBadRequest, CodeHouseholdRequired},
		{"blank header", ptr("   "), http.StatusBadRequest, CodeHouseholdRequired},
		{"not a uuid", ptr("hh-100"), http.StatusBadRequest, CodeHouseholdInvalid},
		{"numeric legacy id", ptr("1"), http.StatusBadRequest, CodeHouseholdInvalid},
		{"non-canonical uuid form", ptr("{" + member.String() + "}"), http.StatusBadRequest, CodeHouseholdInvalid},
		{"not a member", ptr(uuid.NewString()), http.StatusForbidden, CodeHouseholdForbidden},
		{"service unavailable fails closed", ptr("00000000-0000-0000-0000-000000000503"), http.StatusServiceUnavailable, CodeHouseholdServiceUnavailable},
		{"unknown checker error fails closed", ptr("00000000-0000-0000-0000-000000000500"), http.StatusServiceUnavailable, CodeHouseholdServiceUnavailable},
		{"member", ptr(member.String()), http.StatusOK, ""},
		{"member, uppercase header", ptr("7D9F3C1E-4B2A-4C8E-9F10-2A3B4C5D6E7F"), http.StatusOK, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations", nil)
			if tt.header != nil {
				req.Header.Set(HouseholdHeader, *tt.header)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantCode {
				t.Fatalf("expected %d, got %d: %s", tt.wantCode, rec.Code, rec.Body.String())
			}
			if tt.wantErr != "" {
				if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
					t.Errorf("expected application/json, got %q", ct)
				}
				var body errorBody
				if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
					t.Fatalf("invalid error body %q: %v", rec.Body.String(), err)
				}
				if body.Detail.Code != tt.wantErr || body.Detail.Message == "" {
					t.Fatalf("expected detail.code %q with message, got %+v", tt.wantErr, body)
				}
				return
			}
			var got map[string]string
			_ = json.Unmarshal(rec.Body.Bytes(), &got)
			if got["household_id"] != member.String() || got["role"] != "ADMIN" || got["sub"] != "user-1" {
				t.Fatalf("unexpected household context %v", got)
			}
		})
	}
}

func TestRequireHousehold_NoClaimsIsUnauthorized(t *testing.T) {
	checker := &fakeChecker{fn: func(uuid.UUID, string) (householdclient.Membership, error) {
		t.Fatal("checker must not be called without an authenticated user")
		return householdclient.Membership{}, nil
	}}
	h := RequireHousehold(checker, slog.New(slog.NewTextHandler(io.Discard, nil)))(echoHousehold())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(HouseholdHeader, uuid.NewString())
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestRequireHousehold_BadHeaderDoesNotReachMembershipService(t *testing.T) {
	checker := &fakeChecker{fn: func(uuid.UUID, string) (householdclient.Membership, error) {
		return householdclient.Membership{}, nil
	}}
	h := Chain(withTestClaims("u"), RequireHousehold(checker, slog.New(slog.NewTextHandler(io.Discard, nil))))(echoHousehold())
	for _, v := range []string{"", "nope"} {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set(HouseholdHeader, v)
		h.ServeHTTP(httptest.NewRecorder(), req)
	}
	if checker.calls.Load() != 0 {
		t.Fatalf("expected no membership lookups for invalid headers, got %d", checker.calls.Load())
	}
}

// TestRequireHousehold_WithRealClient wires the middleware to a real
// householdclient against a fake core/household, covering caching and 503.
func TestRequireHousehold_WithRealClient(t *testing.T) {
	hh := uuid.New()
	var calls atomic.Int32
	var down atomic.Bool
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if down.Load() {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		if r.Header.Get("Authorization") != "Bearer internal" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.URL.Path != "/internal/v1/memberships/"+hh.String()+"/user-1" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"household_id": hh.String(), "user_id": "user-1", "role": "MEMBER"})
	}))
	defer upstream.Close()

	client := householdclient.New(upstream.URL, "internal")
	h := Chain(withTestClaims("user-1"), RequireHousehold(client, slog.New(slog.NewTextHandler(io.Discard, nil))))(echoHousehold())

	do := func(hhID string) int {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set(HouseholdHeader, hhID)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}

	if code := do(hh.String()); code != http.StatusOK {
		t.Fatalf("expected 200, got %d", code)
	}
	if code := do(hh.String()); code != http.StatusOK {
		t.Fatalf("expected cached 200, got %d", code)
	}
	if calls.Load() != 1 {
		t.Fatalf("expected positive answer to be cached, got %d upstream calls", calls.Load())
	}

	other := uuid.NewString()
	if code := do(other); code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", code)
	}
	if code := do(other); code != http.StatusForbidden {
		t.Fatalf("expected cached 403, got %d", code)
	}
	if calls.Load() != 2 {
		t.Fatalf("expected negative answer to be cached, got %d upstream calls", calls.Load())
	}

	down.Store(true)
	if code := do(uuid.NewString()); code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 while membership service is down, got %d", code)
	}
}

func TestGetHousehold_Missing(t *testing.T) {
	if _, err := GetHousehold(context.Background()); err == nil {
		t.Fatal("expected error for missing household context")
	}
}

func ptr(s string) *string { return &s }
