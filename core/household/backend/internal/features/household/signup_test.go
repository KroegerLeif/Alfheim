package household_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"

	"alfheim/go-shared/auth"
	"alfheim/household/internal/features/household"
)

// stubPolicy admits exactly the subjects in allowed and records who was asked.
type stubPolicy struct {
	allowed map[string]bool
	err     error
	asked   []string
}

func (p *stubPolicy) AllowHouseholdCreation(_ context.Context, claims *auth.UserClaims) error {
	p.asked = append(p.asked, claims.Subject)
	if p.err != nil {
		return p.err
	}
	if !p.allowed[claims.Subject] {
		return errors.New("not listed")
	}
	return nil
}

// TestCreateHousehold_SignupAllowlist covers #923: an unlisted caller without
// a household cannot create one, a listed caller can, an invited user still
// joins and, once a member, is not asked again.
func TestCreateHousehold_SignupAllowlist(t *testing.T) {
	ctx := context.Background()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	repo := newMockRepository()
	policy := &stubPolicy{allowed: map[string]bool{"listed": true}}
	svc := household.NewService(repo, log, household.WithSignupPolicy(policy))
	req := household.CreateHouseholdRequest{Name: "Home"}

	if _, err := svc.CreateHousehold(ctx, &auth.UserClaims{Subject: "stranger"}, req); !errors.Is(err, household.ErrSignupNotAllowed) {
		t.Fatalf("unlisted caller: err = %v, want ErrSignupNotAllowed", err)
	}

	owned, err := svc.CreateHousehold(ctx, &auth.UserClaims{Subject: "listed"}, req)
	if err != nil {
		t.Fatalf("listed caller: %v", err)
	}

	inv, err := svc.CreateInvite(ctx, "listed", household.CreateInviteRequest{
		HouseholdID: owned.ID, Role: "MEMBER", TTLMinutes: 60, MaxUses: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.JoinHousehold(ctx, &auth.UserClaims{Subject: "stranger"}, inv.Token); err != nil {
		t.Fatalf("an invited, unlisted user must still join: %v", err)
	}

	policy.asked = nil
	if _, err := svc.CreateHousehold(ctx, &auth.UserClaims{Subject: "stranger"}, household.CreateHouseholdRequest{Name: "Second"}); err != nil {
		t.Fatalf("a member creating another household: %v", err)
	}
	if len(policy.asked) != 0 {
		t.Errorf("the policy was consulted for an existing member: %v", policy.asked)
	}
}

func TestCreateHousehold_SignupAllowlistFailsClosed(t *testing.T) {
	ctx := context.Background()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	// The e-mail lookup failing denies.
	policy := &stubPolicy{err: errors.New("userinfo unreachable")}
	svc := household.NewService(newMockRepository(), log, household.WithSignupPolicy(policy))
	if _, err := svc.CreateHousehold(ctx, &auth.UserClaims{Subject: "u"}, household.CreateHouseholdRequest{Name: "Home"}); !errors.Is(err, household.ErrSignupNotAllowed) {
		t.Errorf("lookup failure: err = %v, want ErrSignupNotAllowed", err)
	}

	// The membership lookup failing is reported, not ignored.
	repo := newMockRepository()
	boom := errors.New("db down")
	repo.failNext["GetHouseholdsByUserID"] = boom
	svc = household.NewService(repo, log, household.WithSignupPolicy(&stubPolicy{}))
	if _, err := svc.CreateHousehold(ctx, &auth.UserClaims{Subject: "u"}, household.CreateHouseholdRequest{Name: "Home"}); !errors.Is(err, boom) {
		t.Errorf("membership lookup failure: err = %v", err)
	}
}
