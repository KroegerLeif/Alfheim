"""The relative weight engine: resolves a PlanSet's target_weight_type/offset_kg
into a single concrete weight value.

This module is the single source of truth for weight resolution. It is imported
directly (not via HTTP) by both plans/router.py (for plan preview/display) and
session/services/session_lifecycle_service.py (to compute the RESOLVED weight
that gets cloned into a SessionSet at session-start — see that module's docstring
for why the resolved number, not the type/offset, is what gets cloned).
"""

from src.features.exercises.models import UserExercisePreference
from src.features.plans.exceptions import PlanValidationError
from src.features.plans.models import PlanSet, TargetWeightType


def resolve_target_weight(
    plan_set: PlanSet,
    preference: UserExercisePreference | None,
) -> float | None:
    """Resolve a plan set's target weight to a concrete kg value, or None if unresolvable.

    - ABSOLUTE: plan_set.target_weight_kg as-is.
    - DEFAULT: preference.default_target_weight_kg (None if the caller has no baseline yet).
    - OFFSET: preference.default_target_weight_kg + plan_set.offset_kg (None if no baseline).
    """
    if plan_set.target_weight_type == TargetWeightType.ABSOLUTE:
        return plan_set.target_weight_kg

    if plan_set.target_weight_type == TargetWeightType.DEFAULT:
        return preference.default_target_weight_kg if preference else None

    if plan_set.target_weight_type == TargetWeightType.OFFSET:
        if preference is None or preference.default_target_weight_kg is None:
            return None
        offset = plan_set.offset_kg or 0.0
        return preference.default_target_weight_kg + offset

    raise PlanValidationError(f"Unknown target_weight_type: {plan_set.target_weight_type}")


def validate_weight_fields(
    target_weight_type: TargetWeightType,
    target_weight_kg: float | None,
    offset_kg: float | None,
) -> None:
    """Validate that the weight-engine fields on a plan set are internally consistent.

    ABSOLUTE requires target_weight_kg to be set. OFFSET requires offset_kg to be
    set (may be 0.0/negative for a deload). DEFAULT requires neither to be set,
    so a client can't silently supply a weight that will never be read.
    """
    if target_weight_type == TargetWeightType.ABSOLUTE:
        if target_weight_kg is None:
            raise PlanValidationError("target_weight_kg is required when target_weight_type is 'absolute'.")
        if offset_kg is not None:
            raise PlanValidationError("offset_kg must not be set when target_weight_type is 'absolute'.")
    elif target_weight_type == TargetWeightType.OFFSET:
        if offset_kg is None:
            raise PlanValidationError("offset_kg is required when target_weight_type is 'offset'.")
        if target_weight_kg is not None:
            raise PlanValidationError("target_weight_kg must not be set when target_weight_type is 'offset'.")
    elif target_weight_type == TargetWeightType.DEFAULT:
        if target_weight_kg is not None or offset_kg is not None:
            raise PlanValidationError(
                "target_weight_kg and offset_kg must not be set when target_weight_type is 'default'."
            )
