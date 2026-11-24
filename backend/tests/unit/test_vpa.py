from __future__ import annotations

import pytest

from app.core.security import mask_vpa, normalize_vpa


@pytest.mark.parametrize(
    "vpa",
    [
        "alice@okhdfc",
        "alice.kumar-1@okaxis",
        "9876543210@ybl",
        "a_b@upi",
    ],
)
def test_valid_vpa_syntax(vpa: str) -> None:
    assert normalize_vpa(f"  {vpa}  ") == vpa


@pytest.mark.parametrize(
    "vpa",
    [
        "alice",
        "alice@",
        "@okhdfc",
        "alice@@okhdfc",
        "alice@ok hdfc",
        "http://alice@okhdfc",
        "a" * 60 + "@okhdfc",
    ],
)
def test_invalid_vpa_syntax(vpa: str) -> None:
    with pytest.raises(ValueError):
        normalize_vpa(vpa)


def test_mask_vpa_never_returns_full_local_part() -> None:
    masked = mask_vpa("alice@okhdfc")
    assert masked == "al***@okhdfc"
    assert "alice" not in masked
