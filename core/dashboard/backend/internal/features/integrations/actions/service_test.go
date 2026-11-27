package actions

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

var (
	hhA      = uuid.MustParse("11111111-1111-4111-8111-111111111111")
	hhB      = uuid.MustParse("22222222-2222-4222-8222-222222222222")
	template = "33333333-3333-4333-8333-333333333333"
)

func discardLog() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// memRepo filters by household like the SQL repository.
type memRepo struct {
	mu       sync.Mutex
	rules    map[uuid.UUID]Rule
	events   map[string]Record
	err      error
	finishEr error
	findErr  error
}

func newMemRepo() *memRepo {
	return &memRepo{rules: map[uuid.UUID]Rule{}, events: map[string]Record{}}
}

func (m *memRepo) ListRules(_ context.Context, hh uuid.UUID, pt string) ([]Rule, error) {
	out := []Rule{}
	for _, r := range m.rules {
		if r.HouseholdID == hh && r.PluginType == pt {
			out = append(out, r)
		}
	}
	return out, m.err
}

func (m *memRepo) SaveRule(_ context.Context, r *Rule) error {
	if m.err != nil {
		return m.err
	}
	r.ID, r.CreatedAt, r.UpdatedAt = uuid.New(), time.Now(), time.Now()
	m.rules[r.ID] = *r
	return nil
}

func (m *memRepo) DeleteRule(_ context.Context, hh uuid.UUID, pt string, id uuid.UUID) error {
	r, ok := m.rules[id]
	if !ok || r.HouseholdID != hh || r.PluginType != pt {
		return ErrRuleNotFound
	}
	delete(m.rules, id)
	return m.err
}

func (m *memRepo) FindRule(_ context.Context, hh uuid.UUID, pt, et string) (Rule, error) {
	if m.findErr != nil {
		return Rule{}, m.findErr
	}
	for _, r := range m.rules {
		if r.HouseholdID == hh && r.PluginType == pt && r.EventType == et && r.Enabled {
			return r, nil
		}
	}
	return Rule{}, ErrRuleNotFound
}

func (m *memRepo) InsertEvent(_ context.Context, ev Event) (bool, Status, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return false, "", m.err
	}
	key := ev.PluginID.String() + "|" + ev.EventID
	if rec, ok := m.events[key]; ok {
		return false, rec.Status, nil
	}
	m.events[key] = Record{EventID: ev.EventID, EventType: ev.EventType, Status: StatusReceived}
	return true, StatusReceived, nil
}

func (m *memRepo) FinishEvent(_ context.Context, ev Event, action string, res Result) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := ev.PluginID.String() + "|" + ev.EventID
	rec := m.events[key]
	rec.Status, rec.Action, rec.Detail = res.Status, action, res.Detail
	m.events[key] = rec
	return m.finishEr
}

func (m *memRepo) RecentEvents(context.Context, uuid.UUID, string) ([]Record, error) {
	out := []Record{}
	for _, r := range m.events {
		out = append(out, r)
	}
	return out, m.err
}

// countingExecutor records executions and answers a fixed result.
type countingExecutor struct {
	runs []Execution
	res  Result
}

func (c *countingExecutor) Execute(_ context.Context, ex Execution) Result {
	c.runs = append(c.runs, ex)
	return c.res
}

func newTestService(repo *memRepo, exec Executor) *Service {
	return NewService(repo, map[string]Executor{ActionCreateChoreInstance: exec}, discardLog())
}

func TestService_HandleRunsRuleOnceAndKeepsHouseholdsApart(t *testing.T) {
	repo, exec := newMemRepo(), &countingExecutor{res: Result{Status: StatusExecuted}}
	svc := newTestService(repo, exec)
	ctx := context.Background()
	enabled := true
	if _, err := svc.SaveRule(ctx, hhA, "homeassistant", RuleRequest{EventType: "washer_finished",
		Action: ActionCreateChoreInstance, Params: []byte(`{"template_id":"` + template + `"}`), Enabled: &enabled}); err != nil {
		t.Fatal(err)
	}
	ev := Event{PluginID: uuid.New(), HouseholdID: hhA, PluginType: "homeassistant", EventID: "e1", EventType: "washer_finished"}
	out, err := svc.Handle(ctx, ev)
	if err != nil || out.Status != StatusExecuted || out.Replay || len(exec.runs) != 1 || exec.runs[0].EventID != "e1" {
		t.Fatalf("first: %+v %v %+v", out, err, exec.runs)
	}
	out, err = svc.Handle(ctx, ev)
	if err != nil || !out.Replay || out.Status != StatusExecuted || len(exec.runs) != 1 {
		t.Fatalf("replay: %+v %v", out, err)
	}
	evB := Event{PluginID: uuid.New(), HouseholdID: hhB, PluginType: "homeassistant", EventID: "e1", EventType: "washer_finished"}
	if out, _ := svc.Handle(ctx, evB); out.Status != StatusIgnored || len(exec.runs) != 1 {
		t.Fatalf("household B has no rule: %+v", out)
	}
}

func TestService_HandleErrorsAndMissingExecutor(t *testing.T) {
	ctx := context.Background()
	ev := Event{PluginID: uuid.New(), HouseholdID: hhA, PluginType: "homeassistant", EventID: "e1", EventType: "x"}
	repo := newMemRepo()
	repo.err = errors.New("db down")
	if _, err := newTestService(repo, nil).Handle(ctx, ev); err == nil {
		t.Error("insert error")
	}
	repo = newMemRepo()
	repo.findErr = errors.New("db down")
	if _, err := newTestService(repo, nil).Handle(ctx, ev); err == nil {
		t.Error("find error")
	}
	repo = newMemRepo()
	repo.finishEr = errors.New("db down")
	if _, err := newTestService(repo, nil).Handle(ctx, ev); err == nil {
		t.Error("finish error")
	}
	repo = newMemRepo()
	repo.rules[uuid.New()] = Rule{HouseholdID: hhA, PluginType: "homeassistant", EventType: "x", Action: "gone.action", Enabled: true}
	if out, err := newTestService(repo, nil).Handle(ctx, ev); err != nil || out.Status != StatusFailed {
		t.Errorf("an action without executor fails: %+v %v", out, err)
	}
}

func TestService_RulesCRUD(t *testing.T) {
	repo := newMemRepo()
	svc := newTestService(repo, &countingExecutor{})
	ctx := context.Background()
	rule, err := svc.SaveRule(ctx, hhA, "homeassistant", RuleRequest{EventType: "a", Action: ActionCreateChoreInstance,
		Params: []byte(`{"template_id":"` + template + `"}`)})
	if err != nil || !rule.Enabled {
		t.Fatalf("save: %+v %v", rule, err)
	}
	if rules, _ := svc.Rules(ctx, hhB, "homeassistant"); len(rules) != 0 {
		t.Fatal("household B must not see A's rules")
	}
	if err := svc.DeleteRule(ctx, hhB, "homeassistant", rule.ID); !errors.Is(err, ErrRuleNotFound) {
		t.Fatalf("B cannot delete A's rule: %v", err)
	}
	if err := svc.DeleteRule(ctx, hhA, "homeassistant", rule.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Events(ctx, hhA, "homeassistant"); err != nil {
		t.Fatal(err)
	}
	var verr *ValidationError
	if _, err := svc.SaveRule(ctx, hhA, "homeassistant", RuleRequest{EventType: "A B"}); !errors.As(err, &verr) {
		t.Fatalf("validation: %v", err)
	}
	repo.err = errors.New("db down")
	if _, err := svc.SaveRule(ctx, hhA, "homeassistant", RuleRequest{EventType: "a", Action: ActionCreateChoreInstance,
		Params: []byte(`{"template_id":"` + template + `"}`)}); err == nil {
		t.Fatal("repository error must surface")
	}
}

func TestRuleRequestValidate(t *testing.T) {
	ex := map[string]Executor{ActionCreateChoreInstance: &countingExecutor{}, "other.action": &countingExecutor{}}
	for name, tc := range map[string]struct {
		req   RuleRequest
		field string
	}{
		"ok":           {RuleRequest{EventType: "washer.done", Action: ActionCreateChoreInstance, Params: []byte(`{"template_id":"` + template + `"}`)}, ""},
		"other":        {RuleRequest{EventType: "x", Action: "other.action"}, ""},
		"event type":   {RuleRequest{EventType: "", Action: ActionCreateChoreInstance}, "event_type"},
		"action":       {RuleRequest{EventType: "x", Action: "nope"}, "action"},
		"no template":  {RuleRequest{EventType: "x", Action: ActionCreateChoreInstance, Params: []byte(`{}`)}, "params.template_id"},
		"extra fields": {RuleRequest{EventType: "x", Action: ActionCreateChoreInstance, Params: []byte(`{"template_id":"` + template + `","x":1}`)}, "params.template_id"},
	} {
		err := tc.req.Validate(ex)
		var verr *ValidationError
		switch {
		case tc.field == "" && err != nil:
			t.Errorf("%s: %v", name, err)
		case tc.field != "" && (!errors.As(err, &verr) || verr.Field != tc.field || verr.Error() == ""):
			t.Errorf("%s: want %s, got %v", name, tc.field, err)
		}
	}
}
