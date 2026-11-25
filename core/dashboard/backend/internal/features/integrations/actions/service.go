package actions

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
)

// Executor runs one action for one event. It reports failures in the Result,
// never as a panic or a raw upstream error.
type Executor interface {
	Execute(ctx context.Context, ex Execution) Result
}

// Service handles events and manages rules. Executors are keyed by action
// name and passed in by main; an action without an executor cannot be saved.
type Service struct {
	repo      Repository
	executors map[string]Executor
	log       *slog.Logger
}

// NewService returns the actions service.
func NewService(repo Repository, executors map[string]Executor, log *slog.Logger) *Service {
	return &Service{repo: repo, executors: executors, log: log}
}

// Handle stores ev and runs the action its rule names. A known event id is a
// replay: nothing runs and the stored status is returned. Repository errors
// are returned; action failures are a StatusFailed outcome.
func (s *Service) Handle(ctx context.Context, ev Event) (Outcome, error) {
	inserted, status, err := s.repo.InsertEvent(ctx, ev)
	if err != nil {
		return Outcome{}, err
	}
	if !inserted {
		return Outcome{Status: status, Replay: true}, nil
	}
	rule, err := s.repo.FindRule(ctx, ev.HouseholdID, ev.PluginType, ev.EventType)
	if errors.Is(err, ErrRuleNotFound) {
		res := Result{Status: StatusIgnored, Detail: "no rule for this event type"}
		return s.finish(ctx, ev, "", res)
	}
	if err != nil {
		return Outcome{}, err
	}
	res := Result{Status: StatusFailed, Detail: "the action is not available in this build"}
	if exec, ok := s.executors[rule.Action]; ok {
		res = exec.Execute(ctx, Execution{HouseholdID: ev.HouseholdID, EventID: ev.EventID, Params: rule.Params})
	}
	s.log.Info("integration event handled",
		slog.String("household_id", ev.HouseholdID.String()),
		slog.String("event_type", ev.EventType),
		slog.String("action", rule.Action),
		slog.String("status", string(res.Status)))
	return s.finish(ctx, ev, rule.Action, res)
}

func (s *Service) finish(ctx context.Context, ev Event, action string, res Result) (Outcome, error) {
	if err := s.repo.FinishEvent(ctx, ev, action, res); err != nil {
		return Outcome{}, err
	}
	return Outcome{Status: res.Status, Detail: res.Detail}, nil
}

// Rules lists the household's rules of pluginType.
func (s *Service) Rules(ctx context.Context, householdID uuid.UUID, pluginType string) ([]Rule, error) {
	return s.repo.ListRules(ctx, householdID, pluginType)
}

// SaveRule validates req and stores it as the household's rule of its event type.
func (s *Service) SaveRule(ctx context.Context, householdID uuid.UUID, pluginType string, req RuleRequest) (Rule, error) {
	if err := req.Validate(s.executors); err != nil {
		return Rule{}, err
	}
	rule := Rule{
		HouseholdID: householdID,
		PluginType:  pluginType,
		EventType:   req.EventType,
		Action:      req.Action,
		Params:      req.Params,
		Enabled:     req.Enabled == nil || *req.Enabled,
	}
	if err := s.repo.SaveRule(ctx, &rule); err != nil {
		return Rule{}, fmt.Errorf("save rule: %w", err)
	}
	return rule, nil
}

// DeleteRule removes one of the household's rules.
func (s *Service) DeleteRule(ctx context.Context, householdID uuid.UUID, pluginType string, id uuid.UUID) error {
	return s.repo.DeleteRule(ctx, householdID, pluginType, id)
}

// Events returns the household's most recent events of pluginType.
func (s *Service) Events(ctx context.Context, householdID uuid.UUID, pluginType string) ([]Record, error) {
	return s.repo.RecentEvents(ctx, householdID, pluginType)
}
