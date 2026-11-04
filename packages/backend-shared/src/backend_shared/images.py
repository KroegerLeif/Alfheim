"""Image normalisation for uploads: orientation, metadata stripping, downscaling, WebP.

Requires the ``images`` extra of ``backend-shared`` (Pillow and pillow-heif).
"""

from __future__ import annotations

import io
import logging

from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

logger = logging.getLogger(__name__)

register_heif_opener()

WEBP_MIME = "image/webp"
DEFAULT_MAX_EDGE = 2560
DEFAULT_QUALITY = 80
# ~64 megapixels. Pillow warns above this and raises DecompressionBombError at twice the value.
MAX_IMAGE_PIXELS = 64_000_000

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class ImageRejectedError(ValueError):
    """The data is not a decodable image, or is too large to decode safely."""


def normalize_image(
    data: bytes,
    max_edge: int = DEFAULT_MAX_EDGE,
    quality: int = DEFAULT_QUALITY,
) -> tuple[bytes, str]:
    """Return ``(webp_bytes, "image/webp")`` for any JPEG, PNG, WebP or HEIC input.

    The EXIF orientation is applied to the pixels first, then every metadata block (EXIF, GPS, ICC
    profile, XMP) is dropped. The longest edge is capped at ``max_edge`` (never upscaled). Alpha is
    kept. Inputs above ``MAX_IMAGE_PIXELS`` (decompression bombs) and undecodable data raise
    ``ImageRejectedError``.
    """
    try:
        with Image.open(io.BytesIO(data)) as source:
            # Fail on the header, before any pixel data is decoded.
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise ImageRejectedError("image dimensions exceed the allowed pixel count")
            image = ImageOps.exif_transpose(source)
            image.load()
    except ImageRejectedError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageRejectedError("image dimensions exceed the allowed pixel count") from exc
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
        raise ImageRejectedError("data is not a supported image") from exc

    if max(image.size) > max_edge:
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)

    if image.mode not in ("RGB", "RGBA"):
        has_alpha = image.mode in ("LA", "PA") or "transparency" in image.info
        image = image.convert("RGBA" if has_alpha else "RGB")

    output = io.BytesIO()
    # Saving without exif/icc_profile/xmp arguments writes a file with no metadata.
    image.save(output, format="WEBP", quality=quality, method=4)
    return output.getvalue(), WEBP_MIME


def normalize_image_or_400(
    data: bytes, max_edge: int = DEFAULT_MAX_EDGE, quality: int = DEFAULT_QUALITY
) -> tuple[bytes, str]:
    """``normalize_image`` that maps rejection to an HTTP 400 for API handlers."""
    try:
        return normalize_image(data, max_edge=max_edge, quality=quality)
    except ImageRejectedError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid image: {exc}.") from exc
