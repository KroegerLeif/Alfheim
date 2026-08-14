from pint import UnitRegistry

# Initialize the UnitRegistry singleton
ureg = UnitRegistry()

# Define custom count units that are not part of Pint's standard library.
# We establish a "[count]" dimension with "piece" as the base unit.
try:
    ureg.define("piece = [count] = pcs = pieces")
    ureg.define("pack = piece = packs")
    ureg.define("box = piece = boxes")
    ureg.define("bag = piece = bags")
    ureg.define("bottle = piece = bottles")
    ureg.define("can = piece = cans")
    ureg.define("item = piece = items")
    ureg.define("unit = piece = units")
except Exception:
    # Safe fallback if reload or double-initialization occurs
    pass


def is_valid_unit(unit_str: str) -> bool:
    """Check if a given unit string is recognized by the Pint UnitRegistry."""
    if not unit_str or not isinstance(unit_str, str):
        return False
    try:
        ureg.parse_units(unit_str)
        return True
    except Exception:
        return False
