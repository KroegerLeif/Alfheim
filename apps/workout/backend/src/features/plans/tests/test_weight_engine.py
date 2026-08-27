import uuid

import pytest
from src.features.exercises.models import UserExercisePreference
from src.features.plans.exceptions import PlanValidationError
from src.features.plans.models import PlanSet, TargetWeightType
from src.features.plans.services.weight_engine_service import resolve_target_weight, validate_weight_fields


def _make_preference(default_weight: float | None) -> UserExercisePreference:
    return UserExercisePreference(
        home_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        exercise_id=uuid.uuid4(),
        default_target_weight_kg=default_weight,
    )


def _make_set(
    target_weight_type: TargetWeightType = TargetWeightType.DEFAULT,
    target_weight_kg: float | None = None,
    offset_kg: float | None = None,
) -> PlanSet:
    return PlanSet(
        plan_exercise_id=uuid.uuid4(),
        set_order=0,
        target_weight_type=target_weight_type,
        target_weight_kg=target_weight_kg,
        offset_kg=offset_kg,
    )


def test_absolute_returns_target_weight_as_is():
    plan_set = _make_set(target_weight_type=TargetWeightType.ABSOLUTE, target_weight_kg=100.0)
    assert resolve_target_weight(plan_set, preference=None) == 100.0


def test_default_returns_preference_baseline():
    plan_set = _make_set(target_weight_type=TargetWeightType.DEFAULT)
    preference = _make_preference(default_weight=60.0)
    assert resolve_target_weight(plan_set, preference) == 60.0


def test_default_returns_none_when_no_preference_exists():
    plan_set = _make_set(target_weight_type=TargetWeightType.DEFAULT)
    assert resolve_target_weight(plan_set, preference=None) is None


def test_default_returns_none_when_preference_has_no_baseline_yet():
    plan_set = _make_set(target_weight_type=TargetWeightType.DEFAULT)
    preference = _make_preference(default_weight=None)
    assert resolve_target_weight(plan_set, preference) is None


def test_offset_adds_offset_to_baseline():
    plan_set = _make_set(target_weight_type=TargetWeightType.OFFSET, offset_kg=5.0)
    preference = _make_preference(default_weight=60.0)
    assert resolve_target_weight(plan_set, preference) == 65.0


def test_offset_supports_negative_deload():
    plan_set = _make_set(target_weight_type=TargetWeightType.OFFSET, offset_kg=-10.0)
    preference = _make_preference(default_weight=60.0)
    assert resolve_target_weight(plan_set, preference) == 50.0


def test_offset_returns_none_when_no_preference_exists():
    plan_set = _make_set(target_weight_type=TargetWeightType.OFFSET, offset_kg=5.0)
    assert resolve_target_weight(plan_set, preference=None) is None


def test_offset_returns_none_when_preference_has_no_baseline_yet():
    plan_set = _make_set(target_weight_type=TargetWeightType.OFFSET, offset_kg=5.0)
    preference = _make_preference(default_weight=None)
    assert resolve_target_weight(plan_set, preference) is None


def test_validate_absolute_requires_target_weight_kg():
    with pytest.raises(PlanValidationError):
        validate_weight_fields(TargetWeightType.ABSOLUTE, target_weight_kg=None, offset_kg=None)


def test_validate_absolute_rejects_offset_kg():
    with pytest.raises(PlanValidationError):
        validate_weight_fields(TargetWeightType.ABSOLUTE, target_weight_kg=50.0, offset_kg=5.0)


def test_validate_offset_requires_offset_kg():
    with pytest.raises(PlanValidationError):
        validate_weight_fields(TargetWeightType.OFFSET, target_weight_kg=None, offset_kg=None)


def test_validate_offset_rejects_target_weight_kg():
    with pytest.raises(PlanValidationError):
        validate_weight_fields(TargetWeightType.OFFSET, target_weight_kg=50.0, offset_kg=5.0)


def test_validate_default_rejects_any_weight_field():
    with pytest.raises(PlanValidationError):
        validate_weight_fields(TargetWeightType.DEFAULT, target_weight_kg=50.0, offset_kg=None)
    with pytest.raises(PlanValidationError):
        validate_weight_fields(TargetWeightType.DEFAULT, target_weight_kg=None, offset_kg=5.0)


def test_validate_default_accepts_no_weight_fields():
    validate_weight_fields(TargetWeightType.DEFAULT, target_weight_kg=None, offset_kg=None)


def test_validate_offset_accepts_zero_as_valid_offset():
    validate_weight_fields(TargetWeightType.OFFSET, target_weight_kg=None, offset_kg=0.0)
