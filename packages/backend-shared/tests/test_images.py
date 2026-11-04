"""Unit tests for backend_shared.images.normalize_image."""

import io

import pytest
from backend_shared.images import ImageRejectedError, normalize_image, normalize_image_or_400
from fastapi import HTTPException
from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()


def _jpeg(size=(400, 200), orientation=None, gps=False, color=(200, 30, 30)) -> bytes:
    image = Image.new("RGB", size, color)
    exif = Image.Exif()
    exif[0x010F] = "TestCam"  # Make
    if orientation:
        exif[0x0112] = orientation
    if gps:
        gps_ifd = exif.get_ifd(0x8825)
        gps_ifd[1] = "N"
        gps_ifd[2] = (52.0, 31.0, 12.0)
        gps_ifd[3] = "E"
        gps_ifd[4] = (13.0, 24.0, 18.0)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


def _open(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def test_output_is_webp():
    data, mime = normalize_image(_jpeg())
    assert mime == "image/webp"
    assert _open(data).format == "WEBP"


def test_exif_orientation_is_applied_to_pixels():
    # Stored 400x200 with orientation 6 (rotate 90 deg clockwise) displays as 200x400.
    data, _ = normalize_image(_jpeg(size=(400, 200), orientation=6))
    assert _open(data).size == (200, 400)


def test_exif_and_gps_are_removed():
    source = _jpeg(gps=True, orientation=6)
    assert Image.open(io.BytesIO(source)).getexif().get_ifd(0x8825)  # fixture really carries GPS
    data, _ = normalize_image(source)
    result = _open(data)
    assert not result.getexif()
    assert not result.getexif().get_ifd(0x8825)
    assert b"TestCam" not in data
    assert "exif" not in result.info and "icc_profile" not in result.info


def test_longest_edge_is_capped_and_aspect_ratio_kept():
    data, _ = normalize_image(_jpeg(size=(4000, 3000)), max_edge=1000)
    assert _open(data).size == (1000, 750)


def test_small_images_are_not_upscaled():
    data, _ = normalize_image(_jpeg(size=(300, 200)), max_edge=2560)
    assert _open(data).size == (300, 200)


def test_png_alpha_is_kept():
    image = Image.new("RGBA", (64, 64), (255, 0, 0, 0))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    data, _ = normalize_image(buffer.getvalue())
    result = _open(data)
    assert result.mode == "RGBA"
    assert result.getchannel("A").getpixel((10, 10)) == 0


def test_palette_png_with_transparency_keeps_alpha():
    image = Image.new("P", (16, 16), 0)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", transparency=0)
    data, _ = normalize_image(buffer.getvalue())
    assert _open(data).mode == "RGBA"


def test_greyscale_is_converted_to_rgb():
    buffer = io.BytesIO()
    Image.new("L", (16, 16), 128).save(buffer, format="PNG")
    data, _ = normalize_image(buffer.getvalue())
    assert _open(data).mode == "RGB"


def test_heic_is_accepted():
    buffer = io.BytesIO()
    Image.new("RGB", (120, 80), (10, 120, 200)).save(buffer, format="HEIF")
    data, mime = normalize_image(buffer.getvalue())
    assert mime == "image/webp"
    assert _open(data).size == (120, 80)


def test_decompression_bomb_is_rejected(monkeypatch):
    monkeypatch.setattr("backend_shared.images.MAX_IMAGE_PIXELS", 10_000)
    buffer = io.BytesIO()
    Image.new("RGB", (200, 200), (0, 0, 0)).save(buffer, format="PNG")  # 40,000 px, tiny file
    with pytest.raises(ImageRejectedError, match="pixel count"):
        normalize_image(buffer.getvalue())


def test_pillow_decompression_bomb_error_is_mapped(monkeypatch):
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1_000)
    buffer = io.BytesIO()
    Image.new("RGB", (200, 200)).save(buffer, format="PNG")
    with pytest.raises(ImageRejectedError):
        normalize_image(buffer.getvalue())


def test_garbage_is_rejected():
    with pytest.raises(ImageRejectedError):
        normalize_image(b"definitely not an image")


def test_or_400_maps_rejection_to_http_400():
    with pytest.raises(HTTPException) as exc:
        normalize_image_or_400(b"nope")
    assert exc.value.status_code == 400
    assert normalize_image_or_400(_jpeg())[1] == "image/webp"


def test_typical_phone_photo_ends_up_well_under_600_kb():
    """A noisy 4000x3000 photo (~several MB as JPEG) shrinks to far less than 600 KB."""
    # Smooth gradient plus mild noise approximates photographic content.
    base = Image.linear_gradient("L").resize((4000, 3000))
    noise = Image.effect_noise((4000, 3000), 12)
    image = Image.merge("RGB", (base, noise, base.rotate(90)))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=92)
    source = buffer.getvalue()
    data, _ = normalize_image(source)
    assert max(_open(data).size) <= 2560
    assert len(data) < 600_000 < len(source)
